import { RelationalDbProcessor } from "@powerhousedao/reactor-browser";
import type { Action, OperationWithContext } from "document-model";
import {
  fetchModelVersions,
  fetchProjectOverview,
  fetchVersionObjects,
  type SpeckleVersionSummary,
} from "../../editors/shared/speckle.js";
import {
  allTouched,
  categoryDeltas,
  diffGraphs,
  summariseByType,
  type CategoryTotal,
  type SpeckleObjectLike,
} from "./engine.js";
import { up } from "./migrations.js";
import type { DB } from "./schema.js";

/** Only the fields of the sync document this runner needs. */
interface SyncStateShape {
  serverUrl?: string | null;
  projectId?: string | null;
  targetProjectDocumentId?: string | null;
  versionsPerModel?: number | null;
  maxObjectsPerVersion?: number | null;
  runs?: { id: string; outcome: string; fullResync?: boolean }[];
}

/**
 * Pulls a Speckle project into its Powerhouse mirror.
 *
 * The trigger is an operation, not a timer: a REQUEST_SYNC on the sync document
 * is what wakes this up. It then reads Speckle over GraphQL and writes the
 * result into the Speckle Project document with `dispatch`, so every mirrored
 * fact arrives as a normal, auditable operation.
 *
 * Credentials: a server-side sync uses a service credential from
 * `SPECKLE_TOKEN`, never a collaborator's personal token — that one lives in the
 * sync document's *local* scope, which is private to each user and is only
 * meant for client-side use. Public projects sync without any token.
 */
export class SpeckleSyncRunner extends RelationalDbProcessor<DB> {
  /** Injected by the factory so the runner can write into other documents. */
  public dispatchTo?: (
    documentId: string,
    actions: Action[],
  ) => Promise<unknown>;

  async onOperations(operations: OperationWithContext[]): Promise<void> {
    for (const { operation, context } of operations) {
      if (operation.error) continue;
      if (operation.action.type !== "REQUEST_SYNC") continue;

      const state = this.parseState(
        operation.resultingState ?? context.resultingState,
      );

      if (!state) continue;

      await this.runSync(context.documentId, state);
    }
  }

  private parseState(resultingState?: string): SyncStateShape | null {
    if (!resultingState) return null;

    try {
      const parsed: unknown = JSON.parse(resultingState);
      if (parsed === null || typeof parsed !== "object") return null;

      if ("global" in parsed) {
        return ((parsed as { global?: unknown }).global ?? null) as
          | SyncStateShape
          | null;
      }

      return parsed as SyncStateShape;
    } catch {
      return null;
    }
  }

  private action(type: string, input: unknown, scope = "global"): Action {
    return {
      id: crypto.randomUUID(),
      type,
      // Despite the name, the reactor parses this as an ISO date string.
      timestampUtcMs: new Date().toISOString(),
      input,
      scope,
    };
  }

  private async send(documentId: string, actions: Action[]): Promise<void> {
    if (actions.length === 0) return;
    if (!this.dispatchTo) return;

    await this.dispatchTo(documentId, actions);
  }

  private async runSync(
    syncDocumentId: string,
    state: SyncStateShape,
  ): Promise<void> {
    // Newest first, so the run just requested is at the head.
    const run = state.runs?.[0];
    const base = state.serverUrl;
    const projectId = state.projectId;
    const target = state.targetProjectDocumentId;

    if (!run || !base || !projectId || !target) return;

    const token = process.env.SPECKLE_TOKEN ?? null;
    const versionsPerModel = state.versionsPerModel ?? 25;
    const maxObjects = state.maxObjectsPerVersion ?? 5000;

    await this.send(syncDocumentId, [
      this.action("START_RUN", {
        runId: run.id,
        startedAt: new Date().toISOString(),
      }),
    ]);

    let modelsSeen = 0;
    let versionsSeen = 0;
    let versionsAdded = 0;
    let objectsScanned = 0;

    try {
      const overview = await fetchProjectOverview(base, projectId, token);
      const syncedAt = new Date().toISOString();

      await this.send(target, [
        this.action("SET_PROJECT_IDENTITY", {
          serverUrl: base,
          projectId: overview.id,
          name: overview.name,
          visibility: overview.visibility ?? undefined,
          syncedAt,
        }),
      ]);

      for (const model of overview.models) {
        modelsSeen += 1;

        const { versions } = await fetchModelVersions(
          base,
          projectId,
          model.id,
          versionsPerModel,
          token,
        );

        await this.send(target, [
          this.action("UPSERT_MODEL", {
            id: crypto.randomUUID(),
            speckleModelId: model.id,
            name: model.name,
            displayName: model.displayName ?? undefined,
            updatedAt: model.updatedAt ?? undefined,
            latestVersionId: versions[0]?.id,
            versionCount: versions.length,
          }),
        ]);

        // Oldest first, so each revision can be diffed against its predecessor.
        const ordered = [...versions].reverse();
        // A full resync deliberately ignores the cache, which is the way back
        // when a previous run's writes did not land.
        const already = run.fullResync
          ? new Set<string>()
          : await this.alreadySynced(syncDocumentId, model.id);

        let previousObjects: SpeckleObjectLike[] | null = null;
        let previousTotals: CategoryTotal[] | null = null;
        let previousVersionId: string | null = null;

        for (const version of ordered) {
          versionsSeen += 1;

          if (already.has(version.id)) {
            // Known revision: keep the diff chain intact without refetching
            // unless the next one actually needs a predecessor.
            previousObjects = null;
            previousTotals = null;
            previousVersionId = version.id;
            continue;
          }

          const { objects } = await fetchVersionObjects(
            base,
            projectId,
            version.referencedObject,
            { token, maxObjects },
          );

          objectsScanned += objects.length;
          const totals = summariseByType(objects);

          await this.send(target, [
            this.action(
              "UPSERT_REVISION",
              this.revisionInput(model.id, model.displayName ?? model.name, version, objects.length, maxObjects, totals, syncedAt),
            ),
          ]);

          versionsAdded += 1;

          // The predecessor is needed to say what changed; fetch it once if the
          // chain was broken by an already-synced revision.
          if (!previousObjects && previousVersionId) {
            const predecessor = ordered.find(
              (candidate) => candidate.id === previousVersionId,
            );

            if (predecessor) {
              const fetched = await fetchVersionObjects(
                base,
                projectId,
                predecessor.referencedObject,
                { token, maxObjects },
              );

              previousObjects = fetched.objects;
              previousTotals = summariseByType(fetched.objects);
              objectsScanned += fetched.objects.length;
            }
          }

          if (previousObjects && previousTotals && previousVersionId) {
            const diff = diffGraphs(previousObjects, objects);

            await this.send(target, [
              this.action("RECORD_CHANGE", {
                id: crypto.randomUUID(),
                speckleModelId: model.id,
                fromVersionId: previousVersionId,
                toVersionId: version.id,
                detectedAt: new Date().toISOString(),
                touchedElements: allTouched(diff).map((element) => ({
                  id: crypto.randomUUID(),
                  ...element,
                })),
                deltas: categoryDeltas(previousTotals, totals).map((delta) => ({
                  id: crypto.randomUUID(),
                  ...delta,
                  unit: delta.unit ?? undefined,
                  volumeBefore: delta.volumeBefore ?? undefined,
                  volumeAfter: delta.volumeAfter ?? undefined,
                  areaBefore: delta.areaBefore ?? undefined,
                  areaAfter: delta.areaAfter ?? undefined,
                })),
              }),
            ]);
          }

          await this.remember(syncDocumentId, model.id, version, objects.length);

          previousObjects = objects;
          previousTotals = totals;
          previousVersionId = version.id;
        }
      }

      await this.send(syncDocumentId, [
        this.action("COMPLETE_RUN", {
          runId: run.id,
          finishedAt: new Date().toISOString(),
          modelsSeen,
          versionsSeen,
          versionsAdded,
          objectsScanned,
          message:
            versionsAdded === 0
              ? "Already up to date"
              : `Mirrored ${versionsAdded} new revision(s)`,
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      await this.send(syncDocumentId, [
        this.action("FAIL_RUN", {
          runId: run.id,
          finishedAt: new Date().toISOString(),
          message,
        }),
      ]);
    }
  }

  private revisionInput(
    speckleModelId: string,
    modelName: string,
    version: SpeckleVersionSummary,
    objectCount: number,
    maxObjects: number,
    categories: CategoryTotal[],
    syncedAt: string,
  ) {
    return {
      id: crypto.randomUUID(),
      speckleModelId,
      modelName,
      versionId: version.id,
      referencedObject: version.referencedObject,
      message: version.message ?? undefined,
      sourceApplication: version.sourceApplication ?? undefined,
      authorName: version.authorUser?.name ?? undefined,
      createdAt: version.createdAt ?? undefined,
      previewUrl: version.previewUrl ?? undefined,
      objectCount,
      // Flagged so the editor never presents a capped read as a complete one.
      truncated: objectCount >= maxObjects,
      syncedAt,
      categories: categories.map((category) => ({
        id: crypto.randomUUID(),
        speckleType: category.speckleType,
        objectCount: category.objectCount,
        unit: category.unit ?? undefined,
        volume: category.volume ?? undefined,
        area: category.area ?? undefined,
        length: category.length ?? undefined,
      })),
    };
  }

  private async alreadySynced(
    syncDocumentId: string,
    speckleModelId: string,
  ): Promise<Set<string>> {
    const rows = (await this.relationalDb
      .selectFrom("synced_version")
      .select(["version_id"])
      .where("sync_document_id", "=", syncDocumentId)
      .where("speckle_model_id", "=", speckleModelId)
      .execute()) as { version_id: string }[];

    return new Set(rows.map((row) => row.version_id));
  }

  private async remember(
    syncDocumentId: string,
    speckleModelId: string,
    version: SpeckleVersionSummary,
    objectCount: number,
  ): Promise<void> {
    await this.relationalDb
      .deleteFrom("synced_version")
      .where("sync_document_id", "=", syncDocumentId)
      .where("version_id", "=", version.id)
      .execute();

    await this.relationalDb
      .insertInto("synced_version")
      .values({
        sync_document_id: syncDocumentId,
        speckle_model_id: speckleModelId,
        version_id: version.id,
        referenced_object: version.referencedObject,
        object_count: objectCount,
        synced_at: new Date().toISOString(),
      })
      .execute();
  }

  onDisconnect(): Promise<void> {
    return Promise.resolve();
  }

  static override getNamespace(driveId: string): string {
    return super.getNamespace(driveId);
  }

  override async initAndUpgrade(): Promise<void> {
    await up(this.relationalDb);
  }
}
