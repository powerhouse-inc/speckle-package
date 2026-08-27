import {
  clearSyncedData,
  recordChange,
  reducer,
  removeModel,
  removeRevision,
  setProjectIdentity,
  upsertModel,
  upsertRevision,
  utils,
} from "document-models/speckle-project/v1";
import { describe, expect, it } from "vitest";

const SERVER = "http://127.0.0.1";
const T1 = "2026-08-27T10:00:00.000Z";
const T2 = "2026-08-27T11:00:00.000Z";
const T3 = "2026-08-27T12:00:00.000Z";

function lastError(document: {
  operations: Record<string, { error?: string | null }[]>;
}): string | null | undefined {
  const ops = document.operations.global;
  return ops[ops.length - 1].error;
}

type Doc = ReturnType<typeof utils.createDocument>;

const CATEGORIES = [
  {
    id: "c-wall",
    speckleType: "Objects.BuiltElements.Wall",
    objectCount: 12,
    unit: "m",
    volume: 411.6,
    area: 738,
  },
  {
    id: "c-door",
    speckleType: "Objects.BuiltElements.Door",
    objectCount: 18,
  },
];

/** A touched element, the shape RECORD_CHANGE now takes. */
function touched(
  kind: "ADDED" | "MODIFIED" | "REMOVED",
  index: number,
  speckleType = "Objects.BuiltElements.Wall",
) {
  return {
    id: `t-${kind}-${index}`,
    identity: `app:${speckleType}-${index}`,
    objectId: `hash-${kind}-${index}`,
    speckleType,
    kind,
  };
}

function withModel(): Doc {
  let document = reducer(
    utils.createDocument(),
    setProjectIdentity({
      serverUrl: SERVER,
      projectId: "be4c927cce",
      name: "Nordkai Bridge",
      description: "Alliance pilot",
      visibility: "PUBLIC",
      syncedAt: T1,
    }),
  );

  return reducer(
    document,
    upsertModel({
      id: "m-structure",
      speckleModelId: "a3d87099d0",
      name: "structure",
      displayName: "Structure",
      updatedAt: T1,
      latestVersionId: "v2",
      versionCount: 2,
    }),
  );
}

function revisionInput(versionId: string, createdAt: string | undefined, extra = {}) {
  return {
    id: `r-${versionId}`,
    speckleModelId: "a3d87099d0",
    modelName: "Structure",
    versionId,
    referencedObject: `hash-${versionId}`,
    message: `revision ${versionId}`,
    sourceApplication: "revit",
    authorName: "Demo Engineer",
    createdAt,
    objectCount: 34,
    syncedAt: T2,
    categories: CATEGORIES,
    ...extra,
  };
}

function withRevisions(): Doc {
  let document = reducer(withModel(), upsertRevision(revisionInput("v1", T1)));
  return reducer(document, upsertRevision(revisionInput("v2", T2)));
}

describe("project identity", () => {
  it("records what this document mirrors, and clears the mirror", () => {
    const document = withModel();
    const state = document.state.global;

    expect(state.projectId).toBe("be4c927cce");
    expect(state.name).toBe("Nordkai Bridge");
    expect(state.description).toBe("Alliance pilot");
    expect(state.visibility).toBe("PUBLIC");
    expect(state.syncedAt).toBe(T1);
    expect(state.models).toHaveLength(1);

    // Optional fields omitted -> the `|| null` branches.
    const bare = reducer(
      document,
      setProjectIdentity({
        serverUrl: SERVER,
        projectId: "be4c927cce",
        syncedAt: T2,
      }),
    );

    expect(bare.state.global.name).toBeNull();
    expect(bare.state.global.description).toBeNull();
    expect(bare.state.global.visibility).toBeNull();

    const cleared = reducer(withRevisions(), clearSyncedData({}));

    expect(cleared.state.global.models).toHaveLength(0);
    expect(cleared.state.global.revisions).toHaveLength(0);
    expect(cleared.state.global.changes).toHaveLength(0);
    expect(cleared.state.global.syncedAt).toBeNull();
    // Identity survives; only the mirrored data goes.
    expect(cleared.state.global.projectId).toBe("be4c927cce");
  });

  it("rejects a blank project id", () => {
    expect(
      lastError(
        reducer(
          utils.createDocument(),
          setProjectIdentity({ serverUrl: SERVER, projectId: " ", syncedAt: T1 }),
        ),
      ),
    ).toBe("A Speckle project id is required");
  });
});

describe("models are upserted on the Speckle id", () => {
  it("inserts once and updates thereafter", () => {
    const document = withModel();

    expect(document.state.global.models[0].displayName).toBe("Structure");
    expect(document.state.global.models[0].versionCount).toBe(2);

    // Same Speckle id -> update in place, no duplicate.
    const updated = reducer(
      document,
      upsertModel({
        id: "m-ignored",
        speckleModelId: "a3d87099d0",
        name: "structure",
        latestVersionId: "v3",
        versionCount: 3,
      }),
    );

    expect(updated.state.global.models).toHaveLength(1);
    expect(updated.state.global.models[0].id).toBe("m-structure");
    expect(updated.state.global.models[0].versionCount).toBe(3);
    // Optionals omitted on update -> `|| null`.
    expect(updated.state.global.models[0].displayName).toBeNull();
    expect(updated.state.global.models[0].updatedAt).toBeNull();

    // A second, different model inserts.
    const two = reducer(
      updated,
      upsertModel({
        id: "m-mep",
        speckleModelId: "b1c2d3",
        name: "mep",
        versionCount: 0,
      }),
    );

    expect(two.state.global.models).toHaveLength(2);
    expect(two.state.global.models[1].latestVersionId).toBeNull();
  });

  it("rejects a blank model id", () => {
    expect(
      lastError(
        reducer(
          withModel(),
          upsertModel({
            id: "x",
            speckleModelId: "  ",
            name: "bad",
            versionCount: 0,
          }),
        ),
      ),
    ).toBe("A Speckle model id is required");
  });

  it("removing a model takes its revisions and changes with it", () => {
    let document = withRevisions();

    document = reducer(
      document,
      recordChange({
        id: "ch-1",
        speckleModelId: "a3d87099d0",
        fromVersionId: "v1",
        toVersionId: "v2",
        detectedAt: T3,
        touchedElements: [touched("ADDED", 1)],
      }),
    );

    expect(document.state.global.revisions).toHaveLength(2);
    expect(document.state.global.changes).toHaveLength(1);

    const removed = reducer(document, removeModel({ speckleModelId: "a3d87099d0" }));

    expect(removed.state.global.models).toHaveLength(0);
    expect(removed.state.global.revisions).toHaveLength(0);
    expect(removed.state.global.changes).toHaveLength(0);

    expect(lastError(reducer(document, removeModel({ speckleModelId: "nope" })))).toBe(
      "Model nope is not mirrored here",
    );
  });
});

describe("revisions carry the masses read off the graph", () => {
  it("stores categories, defaulting the optional totals", () => {
    const document = withRevisions();
    const revision = document.state.global.revisions.find((r) => r.versionId === "v1");

    expect(revision?.categories).toHaveLength(2);

    const [wall, door] = revision!.categories;

    expect(wall.volume).toBe(411.6);
    expect(wall.area).toBe(738);
    expect(wall.unit).toBe("m");
    expect(wall.length).toBeNull();
    // Door category carries only a count.
    expect(door.objectCount).toBe(18);
    expect(door.unit).toBeNull();
    expect(door.volume).toBeNull();
    expect(door.area).toBeNull();

    // truncated omitted -> `?? false`.
    expect(revision?.truncated).toBe(false);

    const capped = reducer(
      document,
      upsertRevision(revisionInput("v3", T3, { truncated: true, objectCount: 5000 })),
    );

    expect(capped.state.global.revisions[0].truncated).toBe(true);
  });

  it("keeps revisions newest first, with a stable tie-break", () => {
    const document = withRevisions();

    expect(document.state.global.revisions.map((r) => r.versionId)).toStrictEqual([
      "v2",
      "v1",
    ]);

    // Same timestamp -> ordered by version id so arrival order never matters.
    const tied = reducer(document, upsertRevision(revisionInput("v0", T2)));

    expect(tied.state.global.revisions.map((r) => r.versionId)).toStrictEqual([
      "v0",
      "v2",
      "v1",
    ]);

    // No timestamp at all -> the `?? ""` fallback sinks it to the bottom.
    const undated = reducer(tied, upsertRevision(revisionInput("v9", undefined)));

    expect(undated.state.global.revisions.at(-1)?.versionId).toBe("v9");
    expect(undated.state.global.revisions.at(-1)?.createdAt).toBeNull();
  });

  it("upserts on the version id rather than duplicating", () => {
    const document = withRevisions();

    const resynced = reducer(
      document,
      upsertRevision({
        id: "r-ignored",
        speckleModelId: "a3d87099d0",
        versionId: "v2",
        referencedObject: "hash-v2",
        objectCount: 37,
        syncedAt: T3,
        categories: [],
      }),
    );

    expect(resynced.state.global.revisions).toHaveLength(2);

    const revision = resynced.state.global.revisions.find((r) => r.versionId === "v2");

    expect(revision?.id).toBe("r-v2");
    expect(revision?.objectCount).toBe(37);
    expect(revision?.categories).toHaveLength(0);
    expect(revision?.syncedAt).toBe(T3);
    // Optionals omitted on re-sync -> `|| null`.
    expect(revision?.modelName).toBeNull();
    expect(revision?.message).toBeNull();
    expect(revision?.sourceApplication).toBeNull();
    expect(revision?.authorName).toBeNull();
    expect(revision?.previewUrl).toBeNull();
    expect(revision?.createdAt).toBeNull();
  });

  it("rejects an incomplete revision and one whose model is unknown", () => {
    const document = withModel();

    expect(
      lastError(
        reducer(
          document,
          upsertRevision({
            ...revisionInput("v1", T1),
            versionId: " ",
          }),
        ),
      ),
    ).toBe("Both versionId and referencedObject are required");

    expect(
      lastError(
        reducer(
          document,
          upsertRevision({
            ...revisionInput("v1", T1),
            referencedObject: "  ",
          }),
        ),
      ),
    ).toBe("Both versionId and referencedObject are required");

    expect(
      lastError(
        reducer(
          document,
          upsertRevision({
            ...revisionInput("v1", T1),
            speckleModelId: "ghost",
          }),
        ),
      ),
    ).toBe("Model ghost must be mirrored before its revisions");
  });

  it("removing a revision drops the changes that referenced it", () => {
    let document = withRevisions();

    document = reducer(
      document,
      recordChange({
        id: "ch-1",
        speckleModelId: "a3d87099d0",
        fromVersionId: "v1",
        toVersionId: "v2",
        detectedAt: T3,
      }),
    );

    const removed = reducer(document, removeRevision({ versionId: "v2" }));

    expect(removed.state.global.revisions).toHaveLength(1);
    expect(removed.state.global.changes).toHaveLength(0);

    expect(lastError(reducer(document, removeRevision({ versionId: "nope" })))).toBe(
      "Revision nope is not mirrored here",
    );
  });
});

describe("changes describe what moved between revisions", () => {
  it("records touched elements and per-type deltas", () => {
    const document = reducer(
      withRevisions(),
      recordChange({
        id: "ch-1",
        speckleModelId: "a3d87099d0",
        fromVersionId: "v1",
        toVersionId: "v2",
        detectedAt: T3,
        touchedElements: [
          touched("ADDED", 13),
          touched("ADDED", 19, "Objects.BuiltElements.Door"),
          touched("MODIFIED", 2, "Objects.BuiltElements.Floor"),
        ],
        deltas: [
          {
            id: "d-wall",
            speckleType: "Objects.BuiltElements.Wall",
            unit: "m",
            countBefore: 12,
            countAfter: 13,
            volumeBefore: 411.6,
            volumeAfter: 445.9,
          },
        ],
      }),
    );

    const change = document.state.global.changes[0];

    // Counts are derived from the list, so they cannot disagree with it.
    expect(change.addedCount).toBe(2);
    expect(change.modifiedCount).toBe(1);
    expect(change.removedCount).toBe(0);
    expect(change.touchedElements).toHaveLength(3);
    expect(change.touchedElements[0].identity).toBe(
      "app:Objects.BuiltElements.Wall-13",
    );
    expect(change.deltas[0].volumeAfter).toBe(445.9);
    // Optional delta fields omitted -> `?? null`.
    expect(change.deltas[0].areaBefore).toBeNull();
    expect(change.deltas[0].areaAfter).toBeNull();
  });

  it("upserts on model plus target revision", () => {
    let document = reducer(
      withRevisions(),
      recordChange({
        id: "ch-1",
        speckleModelId: "a3d87099d0",
        toVersionId: "v2",
        detectedAt: T3,
        touchedElements: [touched("ADDED", 1)],
      }),
    );

    // First recording had no predecessor -> `|| null`.
    expect(document.state.global.changes[0].fromVersionId).toBeNull();

    document = reducer(
      document,
      recordChange({
        id: "ch-ignored",
        speckleModelId: "a3d87099d0",
        fromVersionId: "v1",
        toVersionId: "v2",
        detectedAt: T3,
        touchedElements: [
          touched("ADDED", 1),
          touched("ADDED", 2),
          touched("REMOVED", 3),
        ],
      }),
    );

    expect(document.state.global.changes).toHaveLength(1);
    expect(document.state.global.changes[0].id).toBe("ch-1");
    expect(document.state.global.changes[0].fromVersionId).toBe("v1");
    expect(document.state.global.changes[0].addedCount).toBe(2);
    expect(document.state.global.changes[0].removedCount).toBe(1);
    expect(document.state.global.changes[0].deltas).toStrictEqual([]);
  });

  it("rejects a change with no target or an unmirrored target", () => {
    const document = withRevisions();

    expect(
      lastError(
        reducer(
          document,
          recordChange({
            id: "ch-1",
            speckleModelId: "a3d87099d0",
            toVersionId: "  ",
            detectedAt: T3,
          }),
        ),
      ),
    ).toBe("A change needs the revision it leads to");

    expect(
      lastError(
        reducer(
          document,
          recordChange({
            id: "ch-1",
            speckleModelId: "a3d87099d0",
            toVersionId: "v99",
            detectedAt: T3,
          }),
        ),
      ),
    ).toBe("Revision v99 is not mirrored here");
  });
});

describe("optional fields on the sparse paths", () => {
  it("inserts a revision carrying only what is required", () => {
    const document = reducer(
      withModel(),
      upsertRevision({
        id: "r-bare",
        speckleModelId: "a3d87099d0",
        versionId: "v-bare",
        referencedObject: "hash-bare",
        objectCount: 0,
        syncedAt: T1,
        categories: [
          {
            id: "c-beam",
            speckleType: "Objects.BuiltElements.Beam",
            objectCount: 4,
            length: 18.5,
          },
        ],
      }),
    );

    const revision = document.state.global.revisions[0];

    expect(revision.modelName).toBeNull();
    expect(revision.message).toBeNull();
    expect(revision.sourceApplication).toBeNull();
    expect(revision.authorName).toBeNull();
    expect(revision.previewUrl).toBeNull();
    expect(revision.createdAt).toBeNull();
    expect(revision.truncated).toBe(false);
    // A length-only category: the other totals stay null.
    expect(revision.categories[0].length).toBe(18.5);
    expect(revision.categories[0].volume).toBeNull();
  });

  it("updates a model without a latest version", () => {
    const document = reducer(
      withModel(),
      upsertModel({
        id: "ignored",
        speckleModelId: "a3d87099d0",
        name: "structure",
        versionCount: 0,
      }),
    );

    expect(document.state.global.models[0].latestVersionId).toBeNull();
    expect(document.state.global.models[0].versionCount).toBe(0);
  });

  it("records a delta with only areas, and no unit", () => {
    const document = reducer(
      withRevisions(),
      recordChange({
        id: "ch-area",
        speckleModelId: "a3d87099d0",
        fromVersionId: "v1",
        toVersionId: "v2",
        detectedAt: T3,
        deltas: [
          {
            id: "d-floor",
            speckleType: "Objects.BuiltElements.Floor",
            countBefore: 4,
            countAfter: 4,
            areaBefore: 392,
            areaAfter: 406,
          },
        ],
      }),
    );

    const delta = document.state.global.changes[0].deltas[0];

    expect(delta.unit).toBeNull();
    expect(delta.volumeBefore).toBeNull();
    expect(delta.volumeAfter).toBeNull();
    expect(delta.areaAfter).toBe(406);
  });

  it("re-recording a change without a predecessor clears it", () => {
    let document = reducer(
      withRevisions(),
      recordChange({
        id: "ch-1",
        speckleModelId: "a3d87099d0",
        fromVersionId: "v1",
        toVersionId: "v2",
        detectedAt: T3,
      }),
    );

    expect(document.state.global.changes[0].fromVersionId).toBe("v1");

    document = reducer(
      document,
      recordChange({
        id: "ch-1",
        speckleModelId: "a3d87099d0",
        toVersionId: "v2",
        detectedAt: T3,
      }),
    );

    expect(document.state.global.changes[0].fromVersionId).toBeNull();
  });

  it("removing the earlier revision also drops the change that came from it", () => {
    let document = reducer(
      withRevisions(),
      recordChange({
        id: "ch-1",
        speckleModelId: "a3d87099d0",
        fromVersionId: "v1",
        toVersionId: "v2",
        detectedAt: T3,
      }),
    );

    // v1 is the change's *predecessor*, not its target.
    const removed = reducer(document, removeRevision({ versionId: "v1" }));

    expect(removed.state.global.revisions.map((r) => r.versionId)).toStrictEqual([
      "v2",
    ]);
    expect(removed.state.global.changes).toHaveLength(0);
  });
});
