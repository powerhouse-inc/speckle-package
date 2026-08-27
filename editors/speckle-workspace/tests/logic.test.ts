import type {
  ChangeEntry,
  Revision,
  SpeckleProjectState,
} from "document-models/speckle-project";
import type { SpeckleSyncState } from "document-models/speckle-sync";
import { describe, expect, it } from "vitest";
import {
  changeFeed,
  driveTotals,
  mirrorCard,
  mirrorCards,
  syncFor,
  unpairedSyncs,
  type ProjectDoc,
  type SyncDoc,
} from "../logic.js";

const T1 = "2026-08-26T10:00:00.000Z";
const T2 = "2026-08-27T10:00:00.000Z";
const T3 = "2026-08-27T12:00:00.000Z";

function revision(
  versionId: string,
  objectCount: number,
  extra: Partial<Revision> = {},
): Revision {
  return {
    id: `r-${versionId}`,
    speckleModelId: "m-1",
    modelName: "Structure",
    versionId,
    referencedObject: `hash-${versionId}`,
    message: `revision ${versionId}`,
    sourceApplication: "revit",
    authorName: "Demo Engineer",
    createdAt: T2,
    objectCount,
    truncated: false,
    previewUrl: null,
    syncedAt: T2,
    categories: [],
    ...extra,
  };
}

function change(overrides: Partial<ChangeEntry> = {}): ChangeEntry {
  return {
    id: "ch-1",
    speckleModelId: "m-1",
    fromVersionId: "v1",
    toVersionId: "v2",
    detectedAt: T2,
    touchedElements: [],
    addedCount: 3,
    removedCount: 1,
    modifiedCount: 2,
    deltas: [],
    ...overrides,
  };
}

function projectState(
  overrides: Partial<SpeckleProjectState> = {},
): SpeckleProjectState {
  return {
    serverUrl: "http://127.0.0.1",
    projectId: "be4c927cce",
    name: "Nordkai Bridge",
    description: null,
    visibility: "PUBLIC",
    syncedAt: T2,
    models: [
      {
        id: "mm-1",
        speckleModelId: "m-1",
        name: "structure",
        displayName: "Structure",
        updatedAt: T2,
        latestVersionId: "v2",
        versionCount: 2,
      },
    ],
    revisions: [revision("v2", 42), revision("v1", 37)],
    changes: [change()],
    ...overrides,
  };
}

function project(
  documentId: string,
  overrides: Partial<SpeckleProjectState> = {},
  documentName = "Nordkai mirror",
): ProjectDoc {
  return { documentId, documentName, state: projectState(overrides) };
}

function syncState(overrides: Partial<SpeckleSyncState> = {}): SpeckleSyncState {
  return {
    serverUrl: "http://127.0.0.1",
    projectId: "be4c927cce",
    projectName: "Nordkai Bridge",
    targetProjectDocumentId: "p-1",
    status: "IDLE",
    autoSync: false,
    versionsPerModel: 25,
    maxObjectsPerVersion: 5000,
    lastRequestedAt: T2,
    lastCompletedAt: T2,
    lastError: null,
    runs: [],
    ...overrides,
  };
}

function sync(
  documentId: string,
  overrides: Partial<SpeckleSyncState> = {},
): SyncDoc {
  return {
    documentId,
    documentName: "Nordkai sync",
    state: syncState(overrides),
  };
}

describe("mirrorCard", () => {
  it("summarises a mirror from its newest revision", () => {
    const card = mirrorCard(project("p-1"));

    expect(card).toMatchObject({
      documentId: "p-1",
      projectName: "Nordkai Bridge",
      modelCount: 1,
      revisionCount: 2,
      objectCount: 42,
      lastChangeSize: 6,
      partial: false,
    });
    expect(card.latestRevision?.versionId).toBe("v2");
  });

  it("falls back through project id to the document name", () => {
    expect(mirrorCard(project("p-1", { name: null })).projectName).toBe(
      "be4c927cce",
    );

    expect(
      mirrorCard(project("p-1", { name: null, projectId: null })).projectName,
    ).toBe("Nordkai mirror");
  });

  it("copes with a mirror that holds nothing yet", () => {
    const card = mirrorCard(
      project("p-empty", { revisions: [], changes: [], models: [] }),
    );

    expect(card.objectCount).toBe(0);
    expect(card.latestRevision).toBeNull();
    expect(card.previewUrl).toBeNull();
    expect(card.lastChangeSize).toBe(0);
  });

  it("reports the newest change, not the first in the list", () => {
    const card = mirrorCard(
      project("p-1", {
        changes: [
          change({ id: "old", detectedAt: T1, addedCount: 100, removedCount: 0, modifiedCount: 0 }),
          change({ id: "new", detectedAt: T3, addedCount: 1, removedCount: 0, modifiedCount: 0 }),
        ],
      }),
    );

    expect(card.lastChangeSize).toBe(1);
  });

  it("flags a mirror whose revisions were capped", () => {
    expect(
      mirrorCard(
        project("p-1", {
          revisions: [revision("v2", 5000, { truncated: true })],
        }),
      ).partial,
    ).toBe(true);
  });

  it("carries the preview image of the newest revision", () => {
    expect(
      mirrorCard(
        project("p-1", {
          revisions: [
            revision("v2", 42, { previewUrl: "http://127.0.0.1/preview/v2" }),
          ],
        }),
      ).previewUrl,
    ).toBe("http://127.0.0.1/preview/v2");
  });
});

describe("mirrorCards", () => {
  it("puts the most recently synced mirror first", () => {
    const cards = mirrorCards([
      project("p-old", { syncedAt: T1 }),
      project("p-new", { syncedAt: T3 }),
      project("p-never", { syncedAt: null }),
    ]);

    expect(cards.map((card) => card.documentId)).toStrictEqual([
      "p-new",
      "p-old",
      "p-never",
    ]);

    expect(mirrorCards([])).toStrictEqual([]);
  });
});

describe("changeFeed", () => {
  it("merges changes across projects, newest first", () => {
    const feed = changeFeed([
      project("p-1", {
        name: "Bridge",
        changes: [change({ id: "a", detectedAt: T1 })],
      }),
      project("p-2", {
        name: "Tower",
        changes: [change({ id: "b", detectedAt: T3 })],
      }),
    ]);

    expect(feed.map((entry) => entry.projectName)).toStrictEqual([
      "Tower",
      "Bridge",
    ]);
    expect(feed[0].key).toBe("p-2:b");
    expect(feed[0].modelName).toBe("Structure");
  });

  it("names the model by its Speckle id when the model is not mirrored", () => {
    const feed = changeFeed([
      project("p-1", {
        models: [],
        changes: [change({ speckleModelId: "m-unknown" })],
      }),
    ]);

    expect(feed[0].modelName).toBe("m-unknown");
  });

  it("honours the limit and breaks ties stably", () => {
    const feed = changeFeed(
      [
        project("p-b", { changes: [change({ id: "x", detectedAt: T2 })] }),
        project("p-a", { changes: [change({ id: "x", detectedAt: T2 })] }),
      ],
      1,
    );

    expect(feed).toHaveLength(1);
    expect(feed[0].documentId).toBe("p-a");
  });

  it("is empty when nothing has changed", () => {
    expect(changeFeed([project("p-1", { changes: [] })])).toStrictEqual([]);
    expect(changeFeed([])).toStrictEqual([]);
  });
});

describe("driveTotals", () => {
  it("rolls up everything on the drive", () => {
    const totals = driveTotals(
      [
        project("p-1"),
        project("p-2", {
          revisions: [revision("v9", 100)],
          changes: [
            change({ id: "c1", addedCount: 1, removedCount: 0, modifiedCount: 0 }),
            change({ id: "c2", addedCount: 0, removedCount: 4, modifiedCount: 0 }),
          ],
        }),
      ],
      [
        sync("s-1"),
        sync("s-2", { status: "FAILED" }),
        sync("s-3", { status: "RUNNING" }),
        sync("s-4", { status: "REQUESTED" }),
      ],
    );

    expect(totals).toStrictEqual({
      mirrors: 2,
      models: 2,
      revisions: 3,
      // Newest revision of each mirror.
      objects: 142,
      elementsChanged: 11,
      syncsFailing: 1,
      syncsRunning: 2,
    });
  });

  it("is all zeroes on an empty drive", () => {
    expect(driveTotals([], [])).toStrictEqual({
      mirrors: 0,
      models: 0,
      revisions: 0,
      objects: 0,
      elementsChanged: 0,
      syncsFailing: 0,
      syncsRunning: 0,
    });
  });
});

describe("pairing syncs with mirrors", () => {
  it("finds the sync writing into a mirror", () => {
    const syncs = [sync("s-1"), sync("s-2", { targetProjectDocumentId: "p-2" })];

    expect(syncFor(syncs, "p-1")?.documentId).toBe("s-1");
    expect(syncFor(syncs, "p-2")?.documentId).toBe("s-2");
    expect(syncFor(syncs, "p-3")).toBeNull();
  });

  it("names the syncs pointing nowhere useful", () => {
    const syncs = [
      sync("s-ok"),
      sync("s-unset", { targetProjectDocumentId: null }),
      sync("s-dangling", { targetProjectDocumentId: "p-deleted" }),
    ];

    expect(
      unpairedSyncs(syncs, [project("p-1")]).map((doc) => doc.documentId),
    ).toStrictEqual(["s-unset", "s-dangling"]);

    expect(unpairedSyncs([], [])).toStrictEqual([]);
  });
});
