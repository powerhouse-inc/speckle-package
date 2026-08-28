import { describe, expect, it } from "vitest";
import {
  allTouched,
  categoryDeltas,
  categoryOf,
  isElement,
  diffGraphs,
  identityOf,
  internalUrl,
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

describe("objects as an IFC import writes them", () => {
  /** The shape speckle_ifc produces: one DataObject type, real class in ifcType. */
  function ifcWall(
    id: string,
    globalId: string,
    quantities: Record<string, unknown>,
    ifcType = "IfcWallStandardCase",
  ): SpeckleObjectLike {
    return {
      id,
      speckleType: "Objects.Data.DataObject",
      data: {
        ifcType,
        applicationId: globalId,
        name: "Wand-Ext-ERDG-1",
        properties: {
          Attributes: { GlobalId: globalId, type: ifcType },
          Quantities: { BaseQuantities: quantities },
          "Building Storey": "Erdgeschoss",
        },
      },
    };
  }

  const BASE = {
    Width: { name: "Width", units: "Metre", value: 0.3 },
    Height: { name: "Height", units: "Metre", value: 2.7 },
    Length: { name: "Length", units: "Metre", value: 9.7 },
    NetVolume: { name: "NetVolume", units: "Cubic Metre", value: 5.80797 },
    GrossVolume: { name: "GrossVolume", units: "Cubic Metre", value: 7.857 },
    NetSideArea: { name: "NetSideArea", units: "Square Metre", value: 26.19 },
  };

  it("groups on the IFC class, not on the one Speckle type they all share", () => {
    expect(categoryOf(ifcWall("a", "g1", BASE))).toBe("IfcWallStandardCase");
    expect(
      categoryOf(ifcWall("b", "g2", BASE, "IfcSlab")),
    ).toBe("IfcSlab");

    // Objects that are not from an IFC import keep their Speckle type.
    expect(
      categoryOf({ id: "c", speckleType: "Objects.BuiltElements.Wall" }),
    ).toBe("Objects.BuiltElements.Wall");
    expect(categoryOf({ id: "d" })).toBe("Unknown");
    expect(categoryOf({ id: "e", speckleType: "X", data: { ifcType: "" } })).toBe("X");
  });

  it("reads the quantities out of the IFC base set", () => {
    const totals = summariseByType([ifcWall("a", "g1", BASE)]);

    expect(totals).toHaveLength(1);
    expect(totals[0].speckleType).toBe("IfcWallStandardCase");
    // Net, not gross: net is what was built.
    expect(totals[0].volume).toBe(5.808);
    expect(totals[0].area).toBe(26.19);
    expect(totals[0].length).toBe(9.7);
  });

  it("derives the unit from the quantity's own spelled-out name", () => {
    const totals = summariseByType([ifcWall("a", "g1", BASE)]);

    // "Cubic Metre" is a volume in metres; the reported unit is the length base.
    expect(totals[0].unit).toBe("m");

    const imperial = summariseByType([
      ifcWall("b", "g2", {
        NetVolume: { name: "NetVolume", units: "Cubic Foot", value: 12 },
      }),
    ]);

    expect(imperial[0].unit).toBe("ft");
  });

  it("prefers a unit the object states outright", () => {
    const object = ifcWall("a", "g1", BASE);
    object.data!.units = "mm";

    expect(summariseByType([object])[0].unit).toBe("mm");
  });

  it("falls back to another exporter's quantity group", () => {
    const object: SpeckleObjectLike = {
      id: "a",
      speckleType: "Objects.Data.DataObject",
      data: {
        ifcType: "IfcSlab",
        properties: {
          Quantities: {
            ArchiCADQuantities: {
              NetVolume: { name: "NetVolume", units: "Cubic Metre", value: 3.5 },
            },
          },
        },
      },
    };

    expect(summariseByType([object])[0].volume).toBe(3.5);
  });

  it("still totals the shape the speckle connectors write", () => {
    const totals = summariseByType([
      { id: "a", speckleType: "Objects.BuiltElements.Wall", data: { units: "m", volume: 34.3 } },
    ]);

    expect(totals[0].volume).toBe(34.3);
    expect(totals[0].unit).toBe("m");
  });

  it("takes the IFC GlobalId as the element's identity", () => {
    // Which is the most stable identifier the format has.
    expect(identityOf(ifcWall("hash", "3rPX_Juz59peXXY6wDJl18", BASE))).toBe(
      "app:3rPX_Juz59peXXY6wDJl18",
    );
  });

  it("copes with objects that carry no quantities at all", () => {
    const bare: SpeckleObjectLike = {
      id: "a",
      speckleType: "Objects.Data.DataObject",
      // A real element, not a space: spaces are spatial structure and excluded.
      data: { ifcType: "IfcRailing", properties: { Attributes: {} } },
    };

    const totals = summariseByType([bare]);

    expect(totals[0]).toStrictEqual({
      speckleType: "IfcRailing",
      objectCount: 1,
      unit: null,
      volume: null,
      area: null,
      length: null,
    });
  });
});

describe("what counts as a building element", () => {
  const of = (speckleType: string, ifcType?: string): SpeckleObjectLike => ({
    id: speckleType,
    speckleType,
    data: ifcType ? { ifcType } : undefined,
  });

  it("leaves out the spatial structure an IFC file is organised by", () => {
    for (const type of [
      "IfcProject",
      "IfcSite",
      "IfcBuilding",
      "IfcBuildingStorey",
      "IfcSpace",
      "IfcZone",
    ]) {
      expect(isElement(of("Objects.Data.DataObject", type))).toBe(false);
    }
  });

  it("leaves out raw geometry, which is the same material counted twice", () => {
    expect(isElement(of("Objects.Geometry.Mesh"))).toBe(false);
    expect(isElement(of("Objects.Geometry.Brep"))).toBe(false);
  });

  it("keeps everything that is actually built", () => {
    expect(isElement(of("Objects.Data.DataObject", "IfcWallStandardCase"))).toBe(true);
    expect(isElement(of("Objects.Data.DataObject", "IfcSlab"))).toBe(true);
    expect(isElement(of("Objects.BuiltElements.Wall"))).toBe(true);
  });

  it("totals only the elements", () => {
    const totals = summariseByType([
      {
        id: "wall",
        speckleType: "Objects.Data.DataObject",
        data: {
          ifcType: "IfcWallStandardCase",
          properties: {
            Quantities: {
              BaseQuantities: {
                NetVolume: { name: "NetVolume", units: "Cubic Metre", value: 5.8 },
              },
            },
          },
        },
      },
      {
        id: "room",
        speckleType: "Objects.Data.DataObject",
        data: {
          ifcType: "IfcSpace",
          properties: {
            Quantities: {
              BaseQuantities: {
                NetVolume: { name: "NetVolume", units: "Cubic Metre", value: 210 },
              },
            },
          },
        },
      },
      { id: "mesh", speckleType: "Objects.Geometry.Mesh" },
    ]);

    // The room's air and the display mesh are both out; only the wall counts.
    expect(totals).toHaveLength(1);
    expect(totals[0].speckleType).toBe("IfcWallStandardCase");
    expect(totals[0].volume).toBe(5.8);
  });
});

describe("internalUrl", () => {
  const PUBLIC = "http://127.0.0.1";
  const INTERNAL = "http://speckle-ingress:8080";

  it("swaps the origin the server cannot reach for the one it can", () => {
    expect(internalUrl(PUBLIC, PUBLIC, INTERNAL)).toBe(INTERNAL);
  });

  it("keeps the path, which carries the project and object ids", () => {
    expect(
      internalUrl(`${PUBLIC}/streams/abc/objects/def`, PUBLIC, INTERNAL),
    ).toBe(`${INTERNAL}/streams/abc/objects/def`);
  });

  it("leaves a different Speckle server alone", () => {
    expect(internalUrl("https://app.speckle.systems", PUBLIC, INTERNAL)).toBe(
      "https://app.speckle.systems",
    );
  });

  it("does not mistake a longer host for the configured one", () => {
    // http://127.0.0.1.evil.example must not match http://127.0.0.1
    expect(
      internalUrl("http://127.0.0.1.evil.example/graphql", PUBLIC, INTERNAL),
    ).toBe("http://127.0.0.1.evil.example/graphql");
  });

  it("ignores trailing slashes on either side", () => {
    expect(internalUrl(`${PUBLIC}/`, `${PUBLIC}/`, `${INTERNAL}/`)).toBe(
      INTERNAL,
    );
  });

  it("is a no-op unless both origins are configured", () => {
    expect(internalUrl(PUBLIC, null, INTERNAL)).toBe(PUBLIC);
    expect(internalUrl(PUBLIC, PUBLIC, undefined)).toBe(PUBLIC);
    expect(internalUrl(PUBLIC, undefined, undefined)).toBe(PUBLIC);
  });
});
