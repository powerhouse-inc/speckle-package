import { describe, expect, it } from "vitest";
import {
  allTouched,
  categoryDeltas,
  diffGraphs,
  identityOf,
  summariseByType,
  toNumber,
  type SpeckleObjectLike,
} from "../engine.js";

/** A Speckle object as the API hands it over. */
function obj(
  id: string,
  speckleType: string,
  data: Record<string, unknown> = {},
): SpeckleObjectLike {
  return { id, speckleType, data };
}

describe("toNumber", () => {
  it("reads the shapes Speckle actually stores", () => {
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber("12.5")).toBe(12.5);
    // Revit parameters arrive wrapped.
    expect(toNumber({ value: 8 })).toBe(8);
    expect(toNumber({ value: { value: "3" } })).toBe(3);
    expect(toNumber(0)).toBe(0);
  });

  it("refuses everything that is not a finite number", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber("not a number")).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
    expect(toNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toNumber({ noValueKey: 1 })).toBeNull();
    expect(toNumber(true)).toBeNull();
    expect(toNumber([])).toBeNull();
  });
});

describe("identityOf", () => {
  it("prefers the authoring tool's element id over the content hash", () => {
    expect(identityOf(obj("hash-1", "Wall", { applicationId: "revit-4711" }))).toBe(
      "app:revit-4711",
    );
  });

  it("falls back to the content hash when there is no application id", () => {
    expect(identityOf(obj("hash-1", "Wall"))).toBe("id:hash-1");
    expect(identityOf(obj("hash-1", "Wall", { applicationId: "" }))).toBe("id:hash-1");
    expect(identityOf(obj("hash-1", "Wall", { applicationId: 42 }))).toBe("id:hash-1");
    expect(identityOf({ id: "hash-1" })).toBe("id:hash-1");
  });
});

describe("summariseByType", () => {
  it("totals the masses that are in the model", () => {
    const totals = summariseByType([
      obj("a", "Objects.BuiltElements.Wall", {
        units: "m",
        volume: 10.5,
        area: 21,
      }),
      obj("b", "Objects.BuiltElements.Wall", {
        units: "m",
        // The other capitalisation, as IFC exporters write it.
        Volume: 4.5,
        Area: 9,
      }),
      obj("c", "Objects.BuiltElements.Beam", { units: "m", length: 6 }),
    ]);

    expect(totals).toStrictEqual([
      {
        speckleType: "Objects.BuiltElements.Wall",
        objectCount: 2,
        unit: "m",
        volume: 15,
        area: 30,
        length: null,
      },
      {
        speckleType: "Objects.BuiltElements.Beam",
        objectCount: 1,
        unit: "m",
        volume: null,
        area: null,
        length: 6,
      },
    ]);
  });

  it("counts objects that carry no quantities at all", () => {
    const totals = summariseByType([
      obj("a", "Objects.Other.RevitInstance"),
      { id: "b" },
    ]);

    expect(totals).toStrictEqual([
      {
        speckleType: "Objects.Other.RevitInstance",
        objectCount: 1,
        unit: null,
        volume: null,
        area: null,
        length: null,
      },
      {
        speckleType: "Unknown",
        objectCount: 1,
        unit: null,
        volume: null,
        area: null,
        length: null,
      },
    ]);
  });

  it("orders by size, then by name", () => {
    const totals = summariseByType([
      obj("a", "Zebra"),
      obj("b", "Alpha"),
      obj("c", "Middle"),
      obj("d", "Middle"),
    ]);

    expect(totals.map((entry) => entry.speckleType)).toStrictEqual([
      "Middle",
      "Alpha",
      "Zebra",
    ]);
  });

  it("keeps the first unit it saw for the type", () => {
    const totals = summariseByType([
      obj("a", "Wall"),
      obj("b", "Wall", { units: "mm" }),
      obj("c", "Wall", { units: "m" }),
    ]);

    expect(totals[0].unit).toBe("mm");
  });

  it("rounds accumulated floats to millimetre precision", () => {
    const totals = summariseByType([
      obj("a", "Wall", { volume: 0.1 }),
      obj("b", "Wall", { volume: 0.2 }),
    ]);

    // 0.1 + 0.2 = 0.30000000000000004 without rounding.
    expect(totals[0].volume).toBe(0.3);
  });

  it("returns nothing for an empty graph", () => {
    expect(summariseByType([])).toStrictEqual([]);
  });
});

describe("diffGraphs", () => {
  const before = [
    obj("h-wall-1", "Wall", { applicationId: "w1" }),
    obj("h-wall-2", "Wall", { applicationId: "w2" }),
    obj("h-door-1", "Door", { applicationId: "d1" }),
  ];

  it("separates added, removed and modified elements", () => {
    const after = [
      // Untouched: same application id, same content hash.
      obj("h-wall-1", "Wall", { applicationId: "w1" }),
      // Edited: same element, new content hash.
      obj("h-wall-2b", "Wall", { applicationId: "w2" }),
      // New.
      obj("h-window-1", "Window", { applicationId: "n1" }),
      // h-door-1 is gone.
    ];

    const diff = diffGraphs(before, after);

    expect(diff.added).toStrictEqual([
      { objectId: "h-window-1", identity: "app:n1", speckleType: "Window", kind: "ADDED" },
    ]);
    expect(diff.removed).toStrictEqual([
      { objectId: "h-door-1", identity: "app:d1", speckleType: "Door", kind: "REMOVED" },
    ]);
    expect(diff.modified).toStrictEqual([
      { objectId: "h-wall-2b", identity: "app:w2", speckleType: "Wall", kind: "MODIFIED" },
    ]);
  });

  it("reports an edit as modified, not as removed-and-added", () => {
    const diff = diffGraphs(
      [obj("hash-old", "Wall", { applicationId: "w1" })],
      [obj("hash-new", "Wall", { applicationId: "w1" })],
    );

    expect(diff.modified.map((e) => e.objectId)).toStrictEqual(["hash-new"]);
    // The identity is the authoring tool's id, which is what made this a
    // modification rather than a replacement.
    expect(diff.modified[0].identity).toBe("app:w1");
    expect(diff.added).toStrictEqual([]);
    expect(diff.removed).toStrictEqual([]);
  });

  it("treats objects without an application id by content hash alone", () => {
    // No application id, so an edit is indistinguishable from a replacement.
    const diff = diffGraphs([obj("hash-old", "Wall")], [obj("hash-new", "Wall")]);

    expect(diff.added.map((e) => e.objectId)).toStrictEqual(["hash-new"]);
    expect(diff.removed.map((e) => e.objectId)).toStrictEqual(["hash-old"]);
    expect(diff.modified).toStrictEqual([]);
    // Falling back to the content hash as identity.
    expect(diff.added[0].identity).toBe("id:hash-new");
  });

  it("sees nothing between two identical graphs", () => {
    expect(diffGraphs(before, before)).toStrictEqual({
      added: [],
      removed: [],
      modified: [],
    });
  });

  it("flattens a diff into one list, added then modified then removed", () => {
    const diff = diffGraphs(before, [
      obj("h-wall-1", "Wall", { applicationId: "w1" }),
      obj("h-wall-2b", "Wall", { applicationId: "w2" }),
      obj("h-window-1", "Window", { applicationId: "n1" }),
    ]);

    expect(allTouched(diff).map((e) => `${e.kind}:${e.objectId}`)).toStrictEqual([
      "ADDED:h-window-1",
      "MODIFIED:h-wall-2b",
      "REMOVED:h-door-1",
    ]);

    expect(allTouched({ added: [], modified: [], removed: [] })).toStrictEqual([]);
  });

  it("handles the first revision, where there is no predecessor", () => {
    expect(diffGraphs([], before).added.map((e) => e.objectId)).toStrictEqual([
      "h-door-1",
      "h-wall-1",
      "h-wall-2",
    ]);

    expect(diffGraphs(before, []).removed.map((e) => e.objectId)).toStrictEqual([
      "h-door-1",
      "h-wall-1",
      "h-wall-2",
    ]);
  });

  it("returns ids in a stable order", () => {
    const diff = diffGraphs(
      [],
      [obj("c", "Wall"), obj("a", "Wall"), obj("b", "Wall")],
    );

    expect(diff.added.map((e) => e.objectId)).toStrictEqual(["a", "b", "c"]);
  });
});

describe("categoryDeltas", () => {
  function total(
    speckleType: string,
    objectCount: number,
    extra: Partial<{ unit: string | null; volume: number | null; area: number | null }> = {},
  ) {
    return {
      speckleType,
      objectCount,
      unit: extra.unit ?? null,
      volume: extra.volume ?? null,
      area: extra.area ?? null,
      length: null,
    };
  }

  it("reports only the types that moved", () => {
    const deltas = categoryDeltas(
      [
        total("Wall", 10, { unit: "m", volume: 100, area: 200 }),
        total("Door", 4, { unit: "m" }),
      ],
      [
        total("Wall", 12, { unit: "m", volume: 130, area: 250 }),
        // Door is untouched and must not show up.
        total("Door", 4, { unit: "m" }),
      ],
    );

    expect(deltas).toStrictEqual([
      {
        speckleType: "Wall",
        unit: "m",
        countBefore: 10,
        countAfter: 12,
        volumeBefore: 100,
        volumeAfter: 130,
        areaBefore: 200,
        areaAfter: 250,
      },
    ]);
  });

  it("reports a type that appeared and one that vanished", () => {
    const deltas = categoryDeltas(
      [total("Door", 4, { unit: "m", volume: 8 })],
      [total("Window", 6, { unit: "m", volume: 3 })],
    );

    expect(deltas).toStrictEqual([
      {
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
        speckleType: "Window",
        unit: "m",
        countBefore: 0,
        countAfter: 6,
        volumeBefore: null,
        volumeAfter: 3,
        areaBefore: null,
        areaAfter: null,
      },
    ]);
  });

  it("notices a mass change even when the count is unchanged", () => {
    // A wall got thicker: same element count, more concrete.
    const deltas = categoryDeltas(
      [total("Wall", 10, { volume: 100 })],
      [total("Wall", 10, { volume: 118 })],
    );

    expect(deltas).toHaveLength(1);
    expect(deltas[0].volumeAfter).toBe(118);
  });

  it("prefers the newer unit and falls back to the older one", () => {
    expect(
      categoryDeltas([total("Wall", 1, { unit: "mm" })], [total("Wall", 2, { unit: "m" })])[0].unit,
    ).toBe("m");

    expect(
      categoryDeltas([total("Wall", 1, { unit: "mm" })], [])[0].unit,
    ).toBe("mm");
  });

  it("sorts by type name and returns nothing when nothing moved", () => {
    const deltas = categoryDeltas(
      [],
      [total("Zebra", 1), total("Alpha", 2)],
    );

    expect(deltas.map((entry) => entry.speckleType)).toStrictEqual(["Alpha", "Zebra"]);

    expect(categoryDeltas([], [])).toStrictEqual([]);
    expect(
      categoryDeltas([total("Wall", 5, { volume: 1, area: 2 })], [total("Wall", 5, { volume: 1, area: 2 })]),
    ).toStrictEqual([]);
  });
});
