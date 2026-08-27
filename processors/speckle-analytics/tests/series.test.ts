import { describe, expect, it } from "vitest";
import {
  buildElementTouches,
  buildSeries,
  categoryPath,
  sourceFor,
  type ProjectStateLike,
  type SeriesRecord,
} from "../series.js";

const DOC = "doc-1";
const T1 = "2026-08-01T09:00:00.000Z";
const T2 = "2026-08-08T09:00:00.000Z";
const T3 = "2026-08-15T09:00:00.000Z";

function category(
  speckleType: string,
  objectCount: number,
  extra: { unit?: string; volume?: number; area?: number; length?: number } = {},
) {
  return { speckleType, objectCount, unit: extra.unit ?? "m", ...extra };
}

function revision(
  versionId: string,
  createdAt: string,
  categories: ReturnType<typeof category>[],
  extra: { truncated?: boolean; sourceApplication?: string | null; authorName?: string | null } = {},
) {
  return {
    speckleModelId: "m-1",
    versionId,
    createdAt,
    syncedAt: T3,
    // `in` rather than `??`, so an explicit null reaches the code under test.
    sourceApplication:
      "sourceApplication" in extra ? extra.sourceApplication : "revit",
    authorName: "authorName" in extra ? extra.authorName : "Demo Engineer",
    truncated: extra.truncated ?? false,
    categories,
  };
}

function touched(kind: string, speckleType: string, index: number) {
  return {
    identity: `app:${speckleType}-${index}`,
    objectId: `hash-${kind}-${index}`,
    speckleType,
    kind,
  };
}

/** Two revisions: walls grow, a beam category appears. */
function state(): ProjectStateLike {
  return {
    projectId: "be4c927cce",
    name: "Nordkai Bridge",
    revisions: [
      // Deliberately newest-first, the order the document keeps.
      revision("v2", T2, [
        category("Objects.BuiltElements.Wall", 13, { volume: 445.9, area: 799.5 }),
        category("Objects.BuiltElements.Beam", 6, { length: 84 }),
      ]),
      revision("v1", T1, [
        category("Objects.BuiltElements.Wall", 12, { volume: 411.6, area: 738 }),
      ]),
    ],
    changes: [
      {
        speckleModelId: "m-1",
        toVersionId: "v2",
        touchedElements: [
          touched("ADDED", "Objects.BuiltElements.Wall", 13),
          touched("ADDED", "Objects.BuiltElements.Beam", 1),
          touched("ADDED", "Objects.BuiltElements.Beam", 2),
          touched("MODIFIED", "Objects.BuiltElements.Wall", 4),
        ],
      },
    ],
  };
}

function find(
  records: SeriesRecord[],
  metric: string,
  predicate: (r: SeriesRecord) => boolean = () => true,
): SeriesRecord[] {
  return records.filter((r) => r.metric === metric && predicate(r));
}

describe("paths", () => {
  it("names the source after the document, so it can be cleared and rewritten", () => {
    expect(sourceFor("doc-1")).toBe("speckle/analytics/doc-1");
  });

  it("turns a Speckle type's dots into path segments", () => {
    expect(categoryPath("Objects.BuiltElements.Wall")).toBe(
      "speckle/category/Objects/BuiltElements/Wall",
    );
    // Level of detail can then roll up to the trade.
    expect(categoryPath("Wall")).toBe("speckle/category/Wall");
    expect(categoryPath("")).toBe("speckle/category/");
  });
});

describe("buildSeries", () => {
  it("writes the opening balance at the first revision", () => {
    const records = buildSeries(state(), DOC);
    const opening = find(
      records,
      "Volume",
      (r) => r.startIso === T1,
    );

    expect(opening).toHaveLength(1);
    // The whole quantity arrives as a delta, so the cumulative read is right.
    expect(opening[0].value).toBe(411.6);
    expect(opening[0].unit).toBe("m");
    expect(opening[0].dimensions.category).toBe(
      "speckle/category/Objects/BuiltElements/Wall",
    );
    expect(opening[0].source).toBe("speckle/analytics/doc-1");
  });

  it("writes quantity movements, not totals", () => {
    const records = buildSeries(state(), DOC);

    const wallVolume = find(
      records,
      "Volume",
      (r) =>
        r.startIso === T2 &&
        r.dimensions.category === categoryPath("Objects.BuiltElements.Wall"),
    );

    // 445.9 - 411.6, rounded to millimetre precision.
    expect(wallVolume).toHaveLength(1);
    expect(wallVolume[0].value).toBe(34.3);

    const beamLength = find(records, "Length", (r) => r.startIso === T2);

    expect(beamLength).toHaveLength(1);
    expect(beamLength[0].value).toBe(84);
  });

  it("counts elements as a movement too", () => {
    const records = buildSeries(state(), DOC);
    const elements = find(records, "Elements", (r) => r.startIso === T2);

    expect(
      elements.map((r) => [r.dimensions.category, r.value]),
    ).toStrictEqual([
      [categoryPath("Objects.BuiltElements.Wall"), 1],
      [categoryPath("Objects.BuiltElements.Beam"), 6],
    ]);
  });

  it("reports a category that vanished as its quantity leaving", () => {
    const shrinking: ProjectStateLike = {
      projectId: "p",
      revisions: [
        revision("v2", T2, [
          category("Objects.BuiltElements.Wall", 12, { volume: 411.6 }),
        ]),
        revision("v1", T1, [
          category("Objects.BuiltElements.Wall", 12, { volume: 411.6 }),
          category("Objects.BuiltElements.Door", 18, { volume: 8 }),
        ]),
      ],
      changes: [],
    };

    const gone = buildSeries(shrinking, DOC).filter(
      (r) =>
        r.startIso === T2 &&
        r.dimensions.category === categoryPath("Objects.BuiltElements.Door"),
    );

    expect(gone.map((r) => [r.metric, r.value])).toStrictEqual([
      ["Elements", -18],
      ["Volume", -8],
    ]);
  });

  it("writes one revision counter per revision, with tool and author", () => {
    const records = find(buildSeries(state(), DOC), "Revisions");

    expect(records).toHaveLength(2);
    expect(records.every((r) => r.value === 1)).toBe(true);
    expect(records[0].dimensions.tool).toBe("speckle/tool/revit");
    expect(records[0].dimensions.author).toBe("speckle/author/Demo Engineer");
  });

  it("falls back to a placeholder for an unknown tool or author", () => {
    const anonymous: ProjectStateLike = {
      projectId: "p",
      revisions: [
        revision("v1", T1, [], { sourceApplication: null, authorName: null }),
      ],
      changes: [],
    };

    const [record] = find(buildSeries(anonymous, DOC), "Revisions");

    expect(record.dimensions.tool).toBe("speckle/tool/unknown");
    expect(record.dimensions.author).toBe("speckle/author/unknown");
  });

  it("counts churn per category and kind", () => {
    const records = buildSeries(state(), DOC);

    expect(
      find(records, "Added").map((r) => [r.dimensions.category, r.value]),
    ).toStrictEqual([
      [categoryPath("Objects.BuiltElements.Wall"), 1],
      [categoryPath("Objects.BuiltElements.Beam"), 2],
    ]);

    expect(find(records, "Modified").map((r) => r.value)).toStrictEqual([1]);
    expect(find(records, "Removed")).toStrictEqual([]);
  });

  it("flags a capped revision so no chart claims to be complete", () => {
    const capped: ProjectStateLike = {
      projectId: "p",
      revisions: [revision("v1", T1, [], { truncated: true })],
      changes: [],
    };

    expect(find(buildSeries(capped, DOC), "Truncated")).toHaveLength(1);
    expect(find(buildSeries(state(), DOC), "Truncated")).toStrictEqual([]);
  });

  it("keeps two models from contaminating each other's curve", () => {
    const two: ProjectStateLike = {
      projectId: "p",
      revisions: [
        { ...revision("b1", T2, [category("Wall", 5, { volume: 50 })]), speckleModelId: "m-2" },
        revision("a1", T1, [category("Wall", 12, { volume: 411.6 })]),
      ],
      changes: [],
    };

    const volumes = find(buildSeries(two, DOC), "Volume");

    // Each model opens its own balance rather than diffing against the other.
    expect(volumes.map((r) => [r.dimensions.model, r.value])).toStrictEqual([
      ["speckle/model/m-1", 411.6],
      ["speckle/model/m-2", 50],
    ]);
  });

  it("falls back to the sync timestamp when a revision has no push date", () => {
    const undated: ProjectStateLike = {
      projectId: "p",
      revisions: [{ ...revision("v1", T1, []), createdAt: null }],
      changes: [],
    };

    expect(find(buildSeries(undated, DOC), "Revisions")[0].startIso).toBe(T3);
  });

  it("writes nothing for an empty mirror", () => {
    expect(
      buildSeries({ projectId: null, revisions: [], changes: [] }, DOC),
    ).toStrictEqual([]);
  });

  it("uses the document id as the project dimension when the mirror is unnamed", () => {
    const bare: ProjectStateLike = {
      projectId: null,
      revisions: [revision("v1", T1, [])],
      changes: [],
    };

    expect(find(buildSeries(bare, DOC), "Revisions")[0].dimensions.project).toBe(
      `speckle/project/${DOC}`,
    );
  });
});

describe("buildElementTouches", () => {
  it("writes one row per element per revision that touched it", () => {
    const rows = buildElementTouches(state(), DOC, () => T2);

    expect(rows).toHaveLength(4);
    expect(rows[0]).toStrictEqual({
      project_document_id: DOC,
      identity: "app:Objects.BuiltElements.Wall-13",
      speckle_model_id: "m-1",
      speckle_type: "Objects.BuiltElements.Wall",
      version_id: "v2",
      kind: "ADDED",
      object_id: "hash-ADDED-13",
      detected_at: T2,
    });
  });

  it("writes nothing when nothing changed", () => {
    expect(
      buildElementTouches(
        { projectId: "p", revisions: [], changes: [] },
        DOC,
        () => T1,
      ),
    ).toStrictEqual([]);
  });
});
