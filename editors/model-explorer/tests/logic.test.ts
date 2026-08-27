import type {
  ChangeEntry,
  Revision,
  SpeckleProjectState,
} from "document-models/speckle-project";
import { describe, expect, it } from "vitest";
import {
  axisLabel,
  categorySeries,
  changeForRevision,
  elementHistory,
  highlightOf,
  changeTotal,
  defaultModelId,
  defaultVersionId,
  massRows,
  massSummary,
  modelOf,
  previousRevision,
  revisionOf,
  churnMax,
  churnSeries,
  churnToStacked,
  chronological,
  readElement,
  revisionsForModel,
  shortType,
  trendToStacked,
  vanishedTypes,
} from "../logic.js";

const T = "2026-08-27T10:00:00.000Z";

function revision(
  versionId: string,
  speckleModelId = "m-1",
  categories: Revision["categories"] = [],
  objectCount = 0,
): Revision {
  return {
    id: `r-${versionId}`,
    speckleModelId,
    modelName: "Structure",
    versionId,
    referencedObject: `hash-${versionId}`,
    message: null,
    sourceApplication: "revit",
    authorName: "Demo Engineer",
    createdAt: T,
    objectCount,
    truncated: false,
    previewUrl: null,
    syncedAt: T,
    categories,
  };
}

function category(
  speckleType: string,
  objectCount: number,
  extra: Partial<Revision["categories"][number]> = {},
): Revision["categories"][number] {
  return {
    id: `c-${speckleType}`,
    speckleType,
    objectCount,
    unit: extra.unit ?? "m",
    volume: extra.volume ?? null,
    area: extra.area ?? null,
    length: extra.length ?? null,
  };
}

function element(
  kind: "ADDED" | "MODIFIED" | "REMOVED",
  objectId: string,
): ChangeEntry["touchedElements"][number] {
  return {
    id: `t-${objectId}`,
    identity: `app:${objectId}`,
    objectId,
    speckleType: "Objects.BuiltElements.Wall",
    kind,
  };
}

function change(overrides: Partial<ChangeEntry> = {}): ChangeEntry {
  return {
    id: "ch-1",
    speckleModelId: "m-1",
    fromVersionId: "v1",
    toVersionId: "v2",
    detectedAt: T,
    touchedElements: [
      element("ADDED", "add-1"),
      element("REMOVED", "rem-1"),
      element("MODIFIED", "mod-1"),
      element("MODIFIED", "mod-2"),
    ],
    addedCount: 1,
    removedCount: 1,
    modifiedCount: 2,
    deltas: [],
    ...overrides,
  };
}

function state(overrides: Partial<SpeckleProjectState> = {}): SpeckleProjectState {
  return {
    serverUrl: "http://127.0.0.1",
    projectId: "be4c927cce",
    name: "Nordkai Bridge",
    description: null,
    visibility: "PUBLIC",
    syncedAt: T,
    models: [
      {
        id: "mm-1",
        speckleModelId: "m-1",
        name: "structure",
        displayName: "Structure",
        updatedAt: T,
        latestVersionId: "v2",
        versionCount: 2,
      },
      {
        id: "mm-2",
        speckleModelId: "m-2",
        name: "mep",
        displayName: null,
        updatedAt: null,
        latestVersionId: null,
        versionCount: 0,
      },
    ],
    // Newest first, as the reducer keeps them.
    revisions: [revision("v2"), revision("v1"), revision("v9", "m-2")],
    changes: [change()],
    ...overrides,
  };
}

describe("shortType", () => {
  it("keeps only the leaf of a Speckle type", () => {
    expect(shortType("Objects.BuiltElements.Wall")).toBe("Wall");
    expect(shortType("Objects.BuiltElements.Revit.RevitWall:Objects.Wall")).toBe(
      "Wall",
    );
    expect(shortType("Wall")).toBe("Wall");
    expect(shortType("")).toBe("");
    expect(shortType("...")).toBe("...");
  });
});

describe("selecting a model and a revision", () => {
  it("finds a model, and nothing for an unknown or absent id", () => {
    expect(modelOf(state(), "m-1")?.name).toBe("structure");
    expect(modelOf(state(), "nope")).toBeNull();
    expect(modelOf(state(), null)).toBeNull();
  });

  it("returns only the selected model's revisions, newest first", () => {
    expect(
      revisionsForModel(state(), "m-1").map((entry) => entry.versionId),
    ).toStrictEqual(["v2", "v1"]);

    expect(revisionsForModel(state(), "m-2")).toHaveLength(1);
    expect(revisionsForModel(state(), null)).toStrictEqual([]);
  });

  it("opens on the model's latest revision", () => {
    const revisions = revisionsForModel(state(), "m-1");

    expect(defaultVersionId(revisions, modelOf(state(), "m-1"))).toBe("v2");
  });

  it("falls back to the newest mirrored revision when the latest is not synced", () => {
    // Speckle reports v7 as latest, but the sync stopped at v2.
    const model = { ...modelOf(state(), "m-1")!, latestVersionId: "v7" };
    const revisions = revisionsForModel(state(), "m-1");

    expect(defaultVersionId(revisions, model)).toBe("v2");
    expect(defaultVersionId(revisions, null)).toBe("v2");
    expect(defaultVersionId([], model)).toBeNull();
  });

  it("opens on the first model, and on nothing when there is none", () => {
    expect(defaultModelId(state())).toBe("m-1");
    expect(defaultModelId(state({ models: [] }))).toBeNull();
  });

  it("resolves a revision and its predecessor", () => {
    const revisions = revisionsForModel(state(), "m-1");

    expect(revisionOf(revisions, "v1")?.referencedObject).toBe("hash-v1");
    expect(revisionOf(revisions, "nope")).toBeNull();
    expect(revisionOf(revisions, null)).toBeNull();

    expect(previousRevision(revisions, "v2")?.versionId).toBe("v1");
    // The oldest revision has no predecessor.
    expect(previousRevision(revisions, "v1")).toBeNull();
    expect(previousRevision(revisions, "nope")).toBeNull();
  });

  it("finds the change that produced a revision", () => {
    expect(changeForRevision(state(), "v2")?.id).toBe("ch-1");
    // The first revision was not produced by a change.
    expect(changeForRevision(state(), "v1")).toBeNull();
    expect(changeForRevision(state(), null)).toBeNull();
  });
});

describe("masses", () => {
  it("totals the categories of the selected revision", () => {
    const selected = revision(
      "v2",
      "m-1",
      [
        category("Objects.BuiltElements.Wall", 12, { volume: 100.5, area: 200 }),
        category("Objects.BuiltElements.Beam", 8, { length: 40 }),
        category("Objects.Other.Instance", 3),
      ],
      23,
    );

    expect(massSummary(selected)).toStrictEqual({
      objectCount: 23,
      volume: 100.5,
      area: 200,
      length: 40,
      categoryCount: 3,
    });
  });

  it("reports an empty summary with no revision selected", () => {
    expect(massSummary(null)).toStrictEqual({
      objectCount: 0,
      volume: null,
      area: null,
      length: null,
      categoryCount: 0,
    });
  });

  it("joins each category with how far it moved", () => {
    const selected = revision("v2", "m-1", [
      category("Wall", 12, { volume: 130, area: 250 }),
      // No delta recorded for this type: it did not move.
      category("Door", 4),
    ]);

    const rows = massRows(
      selected,
      change({
        deltas: [
          {
            id: "d-wall",
            speckleType: "Wall",
            unit: "m",
            countBefore: 10,
            countAfter: 12,
            volumeBefore: 100,
            volumeAfter: 130,
            areaBefore: 250,
            areaAfter: 250,
          },
        ],
      }),
    );

    expect(rows[0].countDelta).toBe(2);
    expect(rows[0].volumeDelta).toBe(30);
    // Same area before and after -> no delta shown.
    expect(rows[0].areaDelta).toBeNull();
    expect(rows[0].shortType).toBe("Wall");

    expect(rows[1].countDelta).toBeNull();
    expect(rows[1].volumeDelta).toBeNull();
  });

  it("shows a delta for a category that only appeared now", () => {
    const rows = massRows(
      revision("v2", "m-1", [category("Window", 6, { volume: 3 })]),
      change({
        deltas: [
          {
            id: "d-window",
            speckleType: "Window",
            unit: "m",
            countBefore: 0,
            countAfter: 6,
            volumeBefore: null,
            volumeAfter: 3,
            areaBefore: null,
            areaAfter: null,
          },
        ],
      }),
    );

    expect(rows[0].countDelta).toBe(6);
    expect(rows[0].volumeDelta).toBe(3);
    expect(rows[0].areaDelta).toBeNull();
  });

  it("has no rows without a revision or without a change", () => {
    expect(massRows(null, change())).toStrictEqual([]);
    expect(massRows(revision("v2"), null)).toStrictEqual([]);
    expect(
      massRows(revision("v2", "m-1", [category("Wall", 1)]), null)[0].countDelta,
    ).toBeNull();
  });

  it("names the categories that disappeared entirely", () => {
    const selected = revision("v2", "m-1", [category("Wall", 12)]);

    const withDrop = change({
      deltas: [
        {
          id: "d-door",
          speckleType: "Door",
          unit: "m",
          countBefore: 4,
          countAfter: 0,
          volumeBefore: 8,
          volumeAfter: null,
          areaBefore: null,
          areaAfter: null,
        },
        {
          id: "d-wall",
          speckleType: "Wall",
          unit: "m",
          countBefore: 10,
          countAfter: 12,
          volumeBefore: null,
          volumeAfter: null,
          areaBefore: null,
          areaAfter: null,
        },
      ],
    });

    expect(vanishedTypes(selected, withDrop)).toStrictEqual(["Door"]);
    expect(vanishedTypes(null, withDrop)).toStrictEqual(["Door"]);
    expect(vanishedTypes(selected, null)).toStrictEqual([]);
  });
});

describe("change size", () => {
  it("counts everything a change touched", () => {
    expect(changeTotal(change())).toBe(4);
    expect(changeTotal(null)).toBe(0);
  });
});

describe("trends over the revision history", () => {
  // Oldest to newest: v1, v2, v3. `revisions` is kept newest first.
  function history(): Revision[] {
    return [
      revision("v3", "m-1", [
        category("Objects.BuiltElements.Wall", 12, { volume: 130 }),
        category("Objects.BuiltElements.Beam", 6, { length: 84 }),
      ]),
      revision("v2", "m-1", [
        category("Objects.BuiltElements.Wall", 13, { volume: 145 }),
        category("Objects.BuiltElements.Door", 20),
      ]),
      revision("v1", "m-1", [
        category("Objects.BuiltElements.Wall", 12, { volume: 130 }),
        category("Objects.BuiltElements.Door", 18),
      ]),
    ];
  }

  it("reads the history oldest first", () => {
    expect(chronological(history()).map((r) => r.versionId)).toStrictEqual([
      "v1",
      "v2",
      "v3",
    ]);
    expect(chronological([])).toStrictEqual([]);
  });

  it("builds one series per category, zero-filling missing revisions", () => {
    const series = categorySeries(history(), "VOLUME");

    // Door and Beam carry no volume at all, so they are not drawn.
    expect(series.categories).toStrictEqual(["Objects.BuiltElements.Wall"]);
    expect(series.points.map((p) => p.total)).toStrictEqual([130, 145, 130]);
    expect(series.max).toBe(145);
    expect(series.unit).toBe("m");
    expect(series.points[0].label).toBe("v1");
  });

  it("orders categories smallest first so the biggest band sits on top", () => {
    const series = categorySeries(history(), "COUNT");

    expect(series.categories).toStrictEqual([
      // Beam 6, Door 38, Wall 37 -> ascending by total across the history.
      "Objects.BuiltElements.Beam",
      "Objects.BuiltElements.Wall",
      "Objects.BuiltElements.Door",
    ]);

    const [first, second, third] = series.points;

    expect(first.values["Objects.BuiltElements.Beam"]).toBe(0);
    expect(second.values["Objects.BuiltElements.Door"]).toBe(20);
    expect(third.values["Objects.BuiltElements.Beam"]).toBe(6);
    // Count has no unit to report.
    expect(series.unit).toBeNull();
  });

  it("plots every measure, and nothing at all for an empty history", () => {
    expect(categorySeries(history(), "LENGTH").categories).toStrictEqual([
      "Objects.BuiltElements.Beam",
    ]);
    expect(categorySeries(history(), "AREA").categories).toStrictEqual([]);

    const empty = categorySeries([], "VOLUME");

    expect(empty).toStrictEqual({
      categories: [],
      points: [],
      max: 0,
      unit: null,
    });
  });

  it("plots churn per revision, skipping the baseline", () => {
    const changes = [
      change({ id: "c2", fromVersionId: "v1", toVersionId: "v2" }),
      change({
        id: "c3",
        fromVersionId: "v2",
        toVersionId: "v3",
        addedCount: 0,
        modifiedCount: 12,
        removedCount: 5,
      }),
    ];

    const points = churnSeries(history(), changes);

    // v1 has no predecessor, so it contributes no bar.
    expect(points.map((p) => p.versionId)).toStrictEqual(["v2", "v3"]);
    expect(points[0].total).toBe(4);
    expect(points[1]).toMatchObject({ added: 0, modified: 12, removed: 5, total: 17 });
    expect(churnMax(points)).toBe(17);

    expect(churnSeries(history(), [])).toStrictEqual([]);
    expect(churnMax([])).toBe(0);
  });
});

describe("axisLabel", () => {
  it("keeps an axis readable at every magnitude", () => {
    expect(axisLabel(0)).toBe("0");
    expect(axisLabel(4.25)).toBe("4.3");
    expect(axisLabel(42)).toBe("42");
    expect(axisLabel(1250)).toBe("1.3k");
    expect(axisLabel(2_500_000)).toBe("2.5M");
    expect(axisLabel(-1250)).toBe("-1.3k");
  });
});

describe("highlightOf", () => {
  it("splits touched elements into the lists the viewer paints", () => {
    expect(highlightOf(change())).toStrictEqual({
      added: ["add-1"],
      modified: ["mod-1", "mod-2"],
      removed: ["rem-1"],
    });
  });

  it("is empty without a change", () => {
    expect(highlightOf(null)).toStrictEqual({
      added: [],
      modified: [],
      removed: [],
    });

    expect(highlightOf(change({ touchedElements: [] }))).toStrictEqual({
      added: [],
      modified: [],
      removed: [],
    });
  });
});

describe("to the chart shape", () => {
  function history(): Revision[] {
    return [
      revision("v2", "m-1", [
        category("Objects.BuiltElements.Wall", 13, { volume: 445.9 }),
      ]),
      revision("v1", "m-1", [
        category("Objects.BuiltElements.Wall", 12, { volume: 411.6 }),
      ]),
    ];
  }

  it("carries the revision series into the shared shape", () => {
    const stacked = trendToStacked(categorySeries(history(), "VOLUME"));

    expect(stacked.keys).toStrictEqual(["Objects.BuiltElements.Wall"]);
    expect(stacked.periods.map((p) => p.period)).toStrictEqual(["v1", "v2"]);
    expect(stacked.periods[1].total).toBe(445.9);
    expect(stacked.max).toBe(445.9);
    expect(stacked.unit).toBe("m");
  });

  it("stacks churn with removals at the bottom", () => {
    const stacked = churnToStacked([
      {
        versionId: "v2",
        label: "v2",
        detectedAt: T,
        added: 3,
        modified: 1,
        removed: 2,
        total: 6,
      },
    ]);

    // Bottom to top: removed, modified, added.
    expect(stacked.keys).toStrictEqual(["removed", "modified", "added"]);
    expect(stacked.periods[0].values).toStrictEqual({
      added: 3,
      modified: 1,
      removed: 2,
    });
    expect(stacked.max).toBe(6);
    expect(stacked.unit).toBeNull();
  });

  it("is empty for no churn", () => {
    expect(churnToStacked([])).toStrictEqual({
      keys: ["removed", "modified", "added"],
      periods: [],
      max: 0,
      unit: null,
    });
  });
});

describe("readElement", () => {
  const wall = {
    id: "hash-wall-4",
    speckle_type: "Objects.BuiltElements.Wall",
    applicationId: "revit-4711",
    units: "m",
    volume: 34.3,
    area: 61.5,
    height: 4.1,
    properties: { category: "Structural", material: "C30/37" },
    displayValue: [{ speckle_type: "Objects.Geometry.Mesh" }],
    __closure: { a: 1 },
    elements: [],
    totalChildrenCount: 3,
  };

  it("puts the quantities first, with the right unit for each dimension", () => {
    const detail = readElement(wall);

    expect(detail.quantities).toStrictEqual([
      { key: "volume", label: "Volume", value: 34.3, unit: "m\u00b3" },
      { key: "area", label: "Area", value: 61.5, unit: "m\u00b2" },
      { key: "height", label: "Height", value: 4.1, unit: "m" },
    ]);
  });

  it("reads identity, object id and type", () => {
    const detail = readElement(wall);

    expect(detail.objectId).toBe("hash-wall-4");
    expect(detail.identity).toBe("revit-4711");
    expect(detail.speckleType).toBe("Objects.BuiltElements.Wall");
  });

  it("flattens the property bag and leaves the plumbing out", () => {
    const labels = readElement(wall).attributes.map((a) => a.label);

    expect(labels).toContain("Category");
    expect(labels).toContain("Material");
    // None of the model's own machinery belongs in a details panel.
    for (const noise of [
      "Display value",
      "Closure",
      "Elements",
      "Total children count",
      "Units",
      "Id",
      "Speckle type",
      "Application id",
    ]) {
      expect(labels).not.toContain(noise);
    }
  });

  it("unwraps the shape Revit writes parameters in", () => {
    const detail = readElement({
      units: "mm",
      volume: { value: 1200, name: "Volume", units: "mm3" },
      properties: { comment: { value: "load bearing" } },
    });

    expect(detail.quantities[0].value).toBe(1200);
    expect(detail.quantities[0].unit).toBe("mm\u00b3");
    expect(
      detail.attributes.find((a) => a.label === "Comment")?.value,
    ).toBe("load bearing");
  });

  it("turns keys into readable labels", () => {
    const labels = readElement({
      properties: { fire_rating: "REI 90", loadBearing: true },
    }).attributes.map((a) => a.label);

    expect(labels).toContain("Fire rating");
    // Word boundaries keep their capital, so acronyms an author wrote survive.
    expect(labels).toContain("Load Bearing");
  });

  it("drops values it cannot show, and never shows the same key twice", () => {
    const detail = readElement({
      properties: { category: "Structural", nested: { deep: { a: 1 } } },
      category: "Should not win over the property bag",
    });

    expect(detail.attributes.filter((a) => a.label === "Category")).toHaveLength(
      1,
    );
    // The bag is read first, so its value is the one kept.
    expect(detail.attributes[0].value).toBe("Structural");
    expect(detail.attributes.map((a) => a.label)).not.toContain("Nested");
  });

  it("has nothing to say about nothing", () => {
    expect(readElement(null)).toStrictEqual({
      objectId: null,
      identity: null,
      speckleType: null,
      quantities: [],
      attributes: [],
    });
    expect(readElement({}).quantities).toStrictEqual([]);
  });
});

describe("elementHistory", () => {
  function touchedBy(
    toVersionId: string,
    detectedAt: string,
    kind: "ADDED" | "MODIFIED" | "REMOVED",
    identity: string,
  ): ChangeEntry {
    return change({
      id: `ch-${toVersionId}`,
      toVersionId,
      detectedAt,
      touchedElements: [
        {
          id: `t-${toVersionId}`,
          identity,
          objectId: `hash-${toVersionId}`,
          speckleType: "Objects.BuiltElements.Wall",
          kind,
        },
      ],
    });
  }

  const changes = [
    touchedBy("v4", "2026-08-17T00:00:00.000Z", "MODIFIED", "app:revit-4711"),
    touchedBy("v2", "2026-06-29T00:00:00.000Z", "ADDED", "app:revit-4711"),
    touchedBy("v3", "2026-07-20T00:00:00.000Z", "ADDED", "app:other"),
  ];

  it("reads one element's history, oldest first", () => {
    const history = elementHistory(changes, "revit-4711", null);

    expect(history.map((touch) => [touch.versionId, touch.kind])).toStrictEqual([
      ["v2", "ADDED"],
      ["v4", "MODIFIED"],
    ]);
  });

  it("matches the stored identity with or without the app prefix", () => {
    expect(elementHistory(changes, "app:revit-4711", null)).toHaveLength(2);
  });

  it("falls back to the object id when there is no identity", () => {
    expect(elementHistory(changes, null, "hash-v3")).toHaveLength(1);
  });

  it("has nothing for an untouched element or no identifier at all", () => {
    expect(elementHistory(changes, "revit-9999", null)).toStrictEqual([]);
    expect(elementHistory(changes, null, null)).toStrictEqual([]);
    expect(elementHistory([], "revit-4711", null)).toStrictEqual([]);
  });
});
