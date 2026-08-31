import {
  AnalyticsPath,
  type AnalyticsSeriesInput,
  type IAnalyticsStore,
} from "@powerhousedao/analytics-engine-core";
import {
  RelationalDbProcessor,
  type OperationWithContext,
} from "@powerhousedao/reactor-browser";
import { DateTime } from "luxon";
import { Coalescer } from "./coalesce.js";
import { up } from "./migrations.js";
import type { DB } from "./schema.js";
import {
  buildElementTouches,
  buildSeries,
  sourceFor,
  type ProjectStateLike,
} from "./series.js";

/**
 * The namespace key for the element-level table.
 *
 * Deliberately not a drive id: this processor is reactor-wide, so its table must
 * be reachable by the subgraph without knowing which drive happened to create
 * the processor.
 */
export const ANALYTICS_NAMESPACE_KEY = "speckle-analytics";

/**
 * Builds the analytics read models for mirrored Speckle projects.
 *
 * Runs in switchboard only, so the series are written once against real
 * Postgres and every client reads them over `/graphql/analytics` — nothing is
 * recomputed per browser.
 *
 * Everything is derived from the mirror document's own state, never from
 * Speckle. That is what makes the read models rebuildable: replaying the
 * document's operations reproduces them exactly, with no external API in the
 * loop.
 *
 * Idempotency is clear-and-rewrite per document. The analytics store has no
 * per-processor namespace, so `clearSeriesBySource` is the only primitive
 * available — and it is enough, because one document owns one source path.
 */
export class SpeckleAnalytics extends RelationalDbProcessor<DB> {
  /**
   * Rebuilds, serialised per document.
   *
   * Every rebuild is total — clear the source, then write it whole — so two of
   * them overlapping for the same document interleaves a clear with a write.
   * Backfilling replays many batches in quick succession, which makes that
   * overlap the normal case rather than a rare one. Because each rebuild
   * supersedes the last, a burst collapses into a single rerun; the Coalescer
   * guarantees the *last* state in a burst is never the one that gets dropped.
   */
  private readonly rebuilds = new Coalescer<ProjectStateLike>((documentId, state) =>
    this.rebuild(documentId, state),
  );

  constructor(
    namespace: string,
    filter: ConstructorParameters<typeof RelationalDbProcessor<DB>>[1],
    store: ConstructorParameters<typeof RelationalDbProcessor<DB>>[2],
    private readonly analyticsStore: IAnalyticsStore,
  ) {
    super(namespace, filter, store);
  }

  override async initAndUpgrade(): Promise<void> {
    await up(this.relationalDb);
  }

  async onOperations(operations: OperationWithContext[]): Promise<void> {
    // One rewrite per document per batch: the last resulting state is the only
    // one worth reading, since each rewrite is total.
    const latest = new Map<string, string>();

    for (const { operation, context } of operations) {
      if (operation.error) continue;

      const state = operation.resultingState ?? context.resultingState;

      if (state) latest.set(context.documentId, state);
    }

    const waits: Promise<void>[] = [];

    for (const [documentId, serialised] of latest) {
      const state = this.parseState(serialised);

      if (state) waits.push(this.rebuilds.submit(documentId, state));
    }

    await Promise.all(waits);
  }

  async onDisconnect(): Promise<void> {
    // Nothing held open: the stores outlive this processor.
  }

  private parseState(serialised: string): ProjectStateLike | null {
    try {
      const parsed = JSON.parse(serialised) as {
        global?: ProjectStateLike;
      } & ProjectStateLike;

      const state = parsed.global ?? parsed;

      return Array.isArray(state.revisions) && Array.isArray(state.changes)
        ? state
        : null;
    } catch {
      return null;
    }
  }

  private async rebuild(
    documentId: string,
    state: ProjectStateLike,
  ): Promise<void> {
    await this.writeSeries(documentId, state);
    await this.writeElementTouches(documentId, state);
  }

  private async writeSeries(
    documentId: string,
    state: ProjectStateLike,
  ): Promise<void> {
    const source = AnalyticsPath.fromString(sourceFor(documentId));

    try {
      // Scoped to our own source, and deliberately without the
      // `cleanUpDimensions` flag. That flag runs a *global* delete of every
      // AnalyticsDimension row no series references yet — and the engine links
      // dimensions in two steps: it selects the ids it needs, then inserts the
      // join rows, with awaits in between. A cleanup fired by one document in
      // that window deletes the ids another document just read, and the insert
      // dies on a foreign key violation. The reactor then marks the processor
      // failed and stops delivering to it, so the read model freezes at
      // whatever was written last and every later query answers, confidently,
      // with stale numbers.
      //
      // Orphaned dimension rows are harmless: they are path strings, reused by
      // path on the next write, bounded by the set of paths we ever emit.
      await this.analyticsStore.clearSeriesBySource(source);
    } catch (error) {
      // A source that was never written cannot be cleared; that is not a
      // failure, and the rewrite below is what matters.
      console.warn("[speckle-analytics] clearSeriesBySource", error);
    }

    const inputs: AnalyticsSeriesInput[] = buildSeries(state, documentId).map(
      (record) => ({
        start: DateTime.fromISO(record.startIso, { zone: "utc" }),
        source: AnalyticsPath.fromString(record.source),
        metric: record.metric,
        value: record.value,
        unit: record.unit ?? null,
        fn: "Single",
        dimensions: Object.fromEntries(
          Object.entries(record.dimensions).map(([name, path]) => [
            name,
            AnalyticsPath.fromString(path),
          ]),
        ),
      }),
    );

    if (inputs.length === 0) return;

    await this.analyticsStore.addSeriesValues(inputs);
  }

  private async writeElementTouches(
    documentId: string,
    state: ProjectStateLike,
  ): Promise<void> {
    await this.relationalDb
      .deleteFrom("element_touch")
      .where("project_document_id", "=", documentId)
      .execute();

    const detectedAt = new Map(
      state.changes.map((change) => [
        change.toVersionId,
        (change as { detectedAt?: string }).detectedAt ??
          new Date().toISOString(),
      ]),
    );

    const rows = buildElementTouches(
      state,
      documentId,
      (change) => detectedAt.get(change.toVersionId) ?? new Date().toISOString(),
    );

    if (rows.length === 0) return;

    await this.relationalDb.insertInto("element_touch").values(rows).execute();
  }
}
