/**
 * Pure roll-up of the Speckle documents on a drive.
 *
 * The drive app shows the state of every mirror at once, so everything here
 * takes plain document shapes rather than reactor hooks and can be tested
 * directly.
 */

import type {
  ChangeEntry,
  Revision,
  SpeckleProjectState,
} from "document-models/speckle-project";
import type { SpeckleSyncState } from "document-models/speckle-sync";

export interface ProjectDoc {
  documentId: string;
  documentName: string;
  state: SpeckleProjectState;
}

export interface SyncDoc {
  documentId: string;
  documentName: string;
  state: SpeckleSyncState;
}

export interface MirrorCard {
  documentId: string;
  documentName: string;
  projectId: string | null;
  projectName: string;
  serverUrl: string | null;
  syncedAt: string | null;
  modelCount: number;
  revisionCount: number;
  objectCount: number;
  latestRevision: Revision | null;
  previewUrl: string | null;
  /** Elements touched by the newest change, or 0 where there is none. */
  lastChangeSize: number;
  /** True where any mirrored revision hit the sync's object cap. */
  partial: boolean;
}

export interface FeedEntry {
  key: string;
  documentId: string;
  projectName: string;
  modelName: string;
  change: ChangeEntry;
}

export interface DriveTotals {
  mirrors: number;
  models: number;
  revisions: number;
  objects: number;
  elementsChanged: number;
  syncsFailing: number;
  syncsRunning: number;
}

function newestRevision(state: SpeckleProjectState): Revision | null {
  // The reducer keeps revisions newest first across all models.
  return state.revisions[0] ?? null;
}

export function mirrorCard(doc: ProjectDoc): MirrorCard {
  const latest = newestRevision(doc.state);

  const newestChange = doc.state.changes.reduce<ChangeEntry | null>(
    (best, entry) =>
      !best || entry.detectedAt > best.detectedAt ? entry : best,
    null,
  );

  return {
    documentId: doc.documentId,
    documentName: doc.documentName,
    projectId: doc.state.projectId ?? null,
    projectName:
      doc.state.name ?? doc.state.projectId ?? doc.documentName,
    serverUrl: doc.state.serverUrl ?? null,
    syncedAt: doc.state.syncedAt ?? null,
    modelCount: doc.state.models.length,
    revisionCount: doc.state.revisions.length,
    objectCount: latest?.objectCount ?? 0,
    latestRevision: latest,
    previewUrl: latest?.previewUrl ?? null,
    lastChangeSize: newestChange
      ? newestChange.addedCount +
        newestChange.removedCount +
        newestChange.modifiedCount
      : 0,
    partial: doc.state.revisions.some((revision) => revision.truncated),
  };
}

/** Mirrors, the most recently synced first. */
export function mirrorCards(docs: ProjectDoc[]): MirrorCard[] {
  return docs
    .map(mirrorCard)
    .sort((a, b) => (b.syncedAt ?? "").localeCompare(a.syncedAt ?? ""));
}

/**
 * Every change on the drive, newest first.
 *
 * This is the drive-level answer to "what moved in the models this week",
 * across projects, without opening any of them.
 */
export function changeFeed(docs: ProjectDoc[], limit = 25): FeedEntry[] {
  const entries: FeedEntry[] = [];

  for (const doc of docs) {
    const projectName =
      doc.state.name ?? doc.state.projectId ?? doc.documentName;

    for (const change of doc.state.changes) {
      const model = doc.state.models.find(
        (entry) => entry.speckleModelId === change.speckleModelId,
      );

      entries.push({
        key: `${doc.documentId}:${change.id}`,
        documentId: doc.documentId,
        projectName,
        modelName:
          model?.displayName ?? model?.name ?? change.speckleModelId,
        change,
      });
    }
  }

  return entries
    .sort(
      (a, b) =>
        b.change.detectedAt.localeCompare(a.change.detectedAt) ||
        a.key.localeCompare(b.key),
    )
    .slice(0, limit);
}

export function driveTotals(
  projects: ProjectDoc[],
  syncs: SyncDoc[],
): DriveTotals {
  let models = 0;
  let revisions = 0;
  let objects = 0;
  let elementsChanged = 0;

  for (const doc of projects) {
    models += doc.state.models.length;
    revisions += doc.state.revisions.length;
    objects += newestRevision(doc.state)?.objectCount ?? 0;

    for (const change of doc.state.changes) {
      elementsChanged +=
        change.addedCount + change.removedCount + change.modifiedCount;
    }
  }

  return {
    mirrors: projects.length,
    models,
    revisions,
    objects,
    elementsChanged,
    syncsFailing: syncs.filter((doc) => doc.state.status === "FAILED").length,
    syncsRunning: syncs.filter(
      (doc) => doc.state.status === "RUNNING" || doc.state.status === "REQUESTED",
    ).length,
  };
}

/** The sync document pointed at a given mirror, where there is one. */
export function syncFor(
  syncs: SyncDoc[],
  projectDocumentId: string,
): SyncDoc | null {
  return (
    syncs.find(
      (doc) => doc.state.targetProjectDocumentId === projectDocumentId,
    ) ?? null
  );
}

/** Sync documents that are not writing into any mirror on this drive. */
export function unpairedSyncs(
  syncs: SyncDoc[],
  projects: ProjectDoc[],
): SyncDoc[] {
  const known = new Set(projects.map((doc) => doc.documentId));

  return syncs.filter(
    (doc) =>
      !doc.state.targetProjectDocumentId ||
      !known.has(doc.state.targetProjectDocumentId),
  );
}
