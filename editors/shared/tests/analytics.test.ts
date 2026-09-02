import { describe, expect, it } from "vitest";
import {
  dimensionOf,
  gridByDimension,
  gridKey,
  leafOf,
  stackByDimension,
  subgraphUrl,
  switchboardBase,
  unitFor,
  type SeriesPeriod,
  type SeriesRow,
} from "../analytics.js";

function row(
  metric: string,
  value: number,
  sum: number,
  dimensions: Record<string, string>,
  unit: string | null = "m",
): SeriesRow {
  return {
    metric,
    unit,
    value,
    sum,
    dimensions: Object.entries(dimensions).map(([name, path]) => ({
      name,
      path,
    })),
  };
}

const WALL = "speckle/category/Objects/BuiltElements/Wall/";
const FLOOR = "speckle/category/Objects/BuiltElements/Floor/";

/** Two months: walls open at 400, floors join in the second month. */
function periods(): SeriesPeriod[] {
  return [
    {
      period: "2026/06",
      start: "2026-06-01T00:00:00.000Z",
      end: "2026-06-30T23:59:59.999Z",
      rows: [row("Volume", 400, 400, { category: WALL })],
    },
    {
      period: "2026/07",
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-07-31T23:59:59.999Z",
      rows: [
        row("Volume", 40, 440, { category: WALL }),
        row("Volume", 100, 100, { category: FLOOR }),
      ],
    },
  ];
}

describe("subgraphUrl", () => {
  it("puts the subgraph under the base it is given", () => {
    expect(subgraphUrl("http://localhost:4011", "analytics")).toBe(
      "http://localhost:4011/graphql/analytics",
    );
    expect(subgraphUrl("http://localhost:4011", "speckle-hotspots")).toBe(
      "http://localhost:4011/graphql/speckle-hotspots",
    );
  });
});

describe("switchboardBase", () => {
  it("prefers the drive the user opened over any configured value", () => {
    // Connect ships DEFAULT_SWITCHBOARD_URL = http://localhost:4001/graphql, so
    // the configured value is never absent. Preferring it sent the analytics to
    // whatever sat on port 4001 — an empty series, no error, blank charts.
    expect(
      switchboardBase({
        configured: "http://localhost:4001/graphql",
        search: "?driveUrl=http%3A%2F%2Flocalhost%3A4011%2Fd%2Fabc",
      }),
    ).toBe("http://localhost:4011");
  });

  it("uses the configured value when nothing names a drive", () => {
    // The ph vetra path: the host sets a real address and there is no parameter.
    expect(switchboardBase({ configured: "http://localhost:4001/graphql" })).toBe(
      "http://localhost:4001",
    );
  });

  it("recovers the base from a drive url, however it is shaped", () => {
    expect(switchboardBase({ configured: "http://localhost:4011/d/abc-123" })).toBe(
      "http://localhost:4011",
    );
    expect(switchboardBase({ configured: "http://localhost:4011/graphql" })).toBe(
      "http://localhost:4011",
    );
    expect(
      switchboardBase({ configured: "http://localhost:4011/graphql/analytics" }),
    ).toBe("http://localhost:4011");
    expect(switchboardBase({ configured: "http://localhost:4011/" })).toBe(
      "http://localhost:4011",
    );
  });

  it("reads the driveUrl parameter Connect was opened with", () => {
    // The link the seed script prints, and how Connect itself finds the drive.
    expect(
      switchboardBase({
        search: "?driveUrl=http%3A%2F%2Flocalhost%3A4011%2Fd%2F49e309cf",
      }),
    ).toBe("http://localhost:4011");
  });

  it("falls back to a drive's own remote url", () => {
    expect(
      switchboardBase({ driveUrl: "http://reactor.example.com/d/xyz" }),
    ).toBe("http://reactor.example.com");
  });

  it("returns null rather than guessing a port", () => {
    // The bug this replaces: a hardcoded http://localhost:4001 meant the charts
    // queried whatever happened to be on that port — answering with an empty
    // series and no error, so they simply drew nothing.
    expect(switchboardBase({})).toBeNull();
    expect(switchboardBase({ configured: null, search: "", driveUrl: null })).toBeNull();
    expect(switchboardBase({ search: "?foo=bar" })).toBeNull();
  });

  it("ignores values that are not absolute http urls", () => {
    expect(switchboardBase({ configured: "not a url" })).toBeNull();
    expect(switchboardBase({ configured: "/d/abc" })).toBeNull();
    expect(switchboardBase({ search: "?driveUrl=%2Fd%2Fabc" })).toBeNull();
  });

  it("survives a malformed query string", () => {
    expect(switchboardBase({ search: "?driveUrl=%E0%A4%A" })).toBeNull();
  });

  it("uses the address remembered from an earlier load", () => {
    // Connect may rewrite the address bar after it has the drive, leaving an
    // editor that mounts later with no parameter to read.
    expect(
      switchboardBase({ search: "?node=abc", remembered: "http://localhost:4011" }),
    ).toBe("http://localhost:4011");
  });

  it("prefers the current parameter over a remembered one", () => {
    expect(
      switchboardBase({
        search: "?driveUrl=http%3A%2F%2Flocalhost%3A4011%2Fd%2Fabc",
        remembered: "http://stale.example.com",
      }),
    ).toBe("http://localhost:4011");
  });

  it("takes the first source that yields a usable base", () => {
    expect(
      switchboardBase({
        configured: "http://last.example.com",
        search: "?driveUrl=http%3A%2F%2Flocalhost%3A4011%2Fd%2Fabc",
        driveUrl: "http://never.example.com/d/abc",
      }),
    ).toBe("http://localhost:4011");
  });
});

describe("reading dimensions", () => {
  it("takes the leaf of a path, which is the part worth showing", () => {
    expect(leafOf(WALL)).toBe("Wall");
    expect(leafOf("speckle/tool/revit/")).toBe("revit");
    expect(leafOf("")).toBe("");
    // Raw Speckle types are dot-delimited and also end up as chart keys.
    expect(leafOf("Objects.BuiltElements.Beam")).toBe("Beam");
  });

  it("finds a named dimension, or nothing", () => {
    const entry = row("Volume", 1, 1, { category: WALL, model: "speckle/model/m1/" });

    expect(dimensionOf(entry, "category")).toBe(WALL);
    expect(dimensionOf(entry, "model")).toBe("speckle/model/m1/");
    expect(dimensionOf(entry, "author")).toBeNull();
  });
});

describe("stackByDimension", () => {
  it("reads the cumulative value as the stock", () => {
    const stacked = stackByDimension(periods(), "category", true);

    expect(stacked.keys).toStrictEqual([FLOOR, WALL]);
    expect(stacked.periods[0].values[WALL]).toBe(400);
    expect(stacked.periods[1].values[WALL]).toBe(440);
    expect(stacked.periods[1].values[FLOOR]).toBe(100);
    expect(stacked.periods[1].total).toBe(540);
    expect(stacked.max).toBe(540);
    expect(stacked.unit).toBe("m");
  });

  it("reads the per-period value as the movement", () => {
    const stacked = stackByDimension(periods(), "category", false);

    expect(stacked.periods[0].total).toBe(400);
    // 40 of wall plus 100 of floor arrived in July.
    expect(stacked.periods[1].total).toBe(140);
  });

  it("zero-fills a period a category is absent from", () => {
    const stacked = stackByDimension(periods(), "category", true);

    expect(stacked.periods[0].values[FLOOR]).toBe(0);
  });

  it("orders keys by size, biggest last so the stack reads bottom-light", () => {
    const stacked = stackByDimension(periods(), "category", true);

    // Floor totals 100, wall totals 840 across the periods.
    expect(stacked.keys).toStrictEqual([FLOOR, WALL]);
  });

  it("drops a dimension that nets to nothing", () => {
    const flat: SeriesPeriod[] = [
      {
        period: "2026/06",
        start: "2026-06-01T00:00:00.000Z",
        end: "2026-06-30T23:59:59.999Z",
        rows: [row("Volume", 0, 0, { category: WALL })],
      },
    ];

    expect(stackByDimension(flat, "category", true).keys).toStrictEqual([]);
  });

  it("ignores rows without the dimension asked for", () => {
    const mixed: SeriesPeriod[] = [
      {
        period: "2026/06",
        start: "2026-06-01T00:00:00.000Z",
        end: "2026-06-30T23:59:59.999Z",
        rows: [
          row("Revisions", 1, 1, { tool: "speckle/tool/revit/" }, null),
          row("Volume", 400, 400, { category: WALL }),
        ],
      },
    ];

    const stacked = stackByDimension(mixed, "category", true);

    expect(stacked.keys).toStrictEqual([WALL]);
    expect(stacked.periods[0].total).toBe(400);
  });

  it("returns an empty series for no periods", () => {
    expect(stackByDimension([], "category", true)).toStrictEqual({
      keys: [],
      periods: [],
      max: 0,
      unit: null,
    });
  });
});

describe("gridByDimension", () => {
  it("builds a period by key grid of movements", () => {
    const grid = gridByDimension(periods(), "category");

    expect(grid.periods).toStrictEqual(["2026/06", "2026/07"]);
    expect(grid.keys).toStrictEqual([FLOOR, WALL]);
    expect(grid.cells.get(gridKey("2026/06", WALL))).toBe(400);
    expect(grid.cells.get(gridKey("2026/07", FLOOR))).toBe(100);
    // June has no floor movement at all, so there is no cell.
    expect(grid.cells.has(gridKey("2026/06", FLOOR))).toBe(false);
    expect(grid.max).toBe(400);
  });

  it("leaves out periods where nothing moved", () => {
    const withQuiet: SeriesPeriod[] = [
      ...periods(),
      {
        period: "2026/08",
        start: "2026-08-01T00:00:00.000Z",
        end: "2026-08-31T23:59:59.999Z",
        rows: [row("Volume", 0, 540, { category: WALL })],
      },
    ];

    expect(gridByDimension(withQuiet, "category").periods).toStrictEqual([
      "2026/06",
      "2026/07",
    ]);
  });

  it("tracks the largest magnitude, including a decrease", () => {
    const shrinking: SeriesPeriod[] = [
      {
        period: "2026/08",
        start: "2026-08-01T00:00:00.000Z",
        end: "2026-08-31T23:59:59.999Z",
        rows: [row("Volume", -900, 100, { category: WALL })],
      },
    ];

    const grid = gridByDimension(shrinking, "category");

    expect(grid.cells.get(gridKey("2026/08", WALL))).toBe(-900);
    expect(grid.max).toBe(900);
  });

  it("is empty for no periods", () => {
    expect(gridByDimension([], "category")).toStrictEqual({
      keys: [],
      periods: [],
      cells: new Map(),
      max: 0,
    });
  });
});

describe("unitFor", () => {
  it("cubes and squares the length unit Speckle records", () => {
    // The objects carry `units: "m"`; a summed volume is therefore in m3.
    expect(unitFor("Volume", "m")).toBe("m\u00b3");
    expect(unitFor("Area", "m")).toBe("m\u00b2");
    expect(unitFor("Length", "m")).toBe("m");
    expect(unitFor("Volume", "mm")).toBe("mm\u00b3");
  });

  it("leaves counts dimensionless", () => {
    expect(unitFor("Elements", "m")).toBeNull();
    expect(unitFor("Revisions", "m")).toBeNull();
    expect(unitFor("Added", "m")).toBeNull();
  });

  it("has nothing to print when the objects carried no unit", () => {
    expect(unitFor("Volume", null)).toBeNull();
  });
});
