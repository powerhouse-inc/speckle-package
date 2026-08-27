import { describe, expect, it } from "vitest";
import {
  axisLabel,
  axisMax,
  formatValue,
  labelStride,
  nearestIndex,
  niceTicks,
  seriesMax,
  showsLabel,
  stackTops,
  trimEmpty,
  type StackedSeries,
} from "../chart-model.js";

function series(
  periods: [string, Record<string, number>][],
  keys: string[],
): StackedSeries {
  const shaped = periods.map(([period, values]) => ({
    period,
    start: `${period}-01T00:00:00.000Z`,
    values,
    total: Object.values(values).reduce((sum, value) => sum + value, 0),
  }));

  return {
    keys,
    periods: shaped,
    max: shaped.reduce((peak, period) => Math.max(peak, period.total), 0),
    unit: "m",
  };
}

describe("trimEmpty", () => {
  it("drops the padding periods a query window adds", () => {
    const trimmed = trimEmpty(
      series(
        [
          ["2026/05", { wall: 0 }],
          ["2026/06", { wall: 400 }],
          ["2026/07", { wall: 440 }],
          ["2026/09", { wall: 0 }],
        ],
        ["wall"],
      ),
    );

    expect(trimmed.periods.map((p) => p.period)).toStrictEqual([
      "2026/06",
      "2026/07",
    ]);
    expect(trimmed.max).toBe(440);
  });

  it("keeps interior zeroes, which are real quiet periods", () => {
    const trimmed = trimEmpty(
      series(
        [
          ["2026/06", { wall: 400 }],
          ["2026/07", { wall: 0 }],
          ["2026/08", { wall: 300 }],
        ],
        ["wall"],
      ),
    );

    expect(trimmed.periods.map((p) => p.period)).toStrictEqual([
      "2026/06",
      "2026/07",
      "2026/08",
    ]);
  });

  it("keeps a period whose total nets to zero but carries movement", () => {
    // +300 and -300 cancel in the total, yet something clearly happened.
    const trimmed = trimEmpty(
      series([["2026/06", { added: 300, removed: -300 }]], ["added", "removed"]),
    );

    expect(trimmed.periods).toHaveLength(1);
  });

  it("returns nothing when every period is empty", () => {
    const trimmed = trimEmpty(
      series(
        [
          ["2026/05", { wall: 0 }],
          ["2026/06", { wall: 0 }],
        ],
        ["wall"],
      ),
    );

    expect(trimmed.periods).toStrictEqual([]);
    expect(trimmed.max).toBe(0);
  });
});

describe("stackTops", () => {
  it("stacks each band on the one below it", () => {
    const tops = stackTops(
      series(
        [
          ["2026/06", { beam: 10, wall: 400 }],
          ["2026/07", { beam: 20, wall: 440 }],
        ],
        ["beam", "wall"],
      ),
    );

    expect(tops).toStrictEqual([
      { beam: 10, wall: 410 },
      { beam: 20, wall: 460 },
    ]);
  });

  it("treats a key absent from a period as zero", () => {
    const tops = stackTops({
      keys: ["beam", "wall"],
      periods: [
        {
          period: "2026/06",
          start: "",
          values: { wall: 400 },
          total: 400,
        },
      ],
      max: 400,
      unit: null,
    });

    expect(tops[0]).toStrictEqual({ beam: 0, wall: 400 });
  });
});

describe("niceTicks", () => {
  it("rounds to numbers a reader can compare against", () => {
    expect(niceTicks(578)).toStrictEqual([0, 200, 400, 600]);
    expect(niceTicks(17)).toStrictEqual([0, 5, 10, 15, 20]);
    expect(niceTicks(4)).toStrictEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(2_175)).toStrictEqual([0, 500, 1000, 1500, 2000, 2500]);
  });

  it("degenerates safely", () => {
    expect(niceTicks(0)).toStrictEqual([0]);
    expect(niceTicks(-5)).toStrictEqual([0]);
  });

  it("gives the plot a top that never clips the area", () => {
    expect(axisMax(578)).toBe(600);
    expect(axisMax(17)).toBe(20);
    // A max already on a tick stays where it is.
    expect(axisMax(600)).toBe(600);
    expect(axisMax(0)).toBe(0);
  });
});

describe("nearestIndex", () => {
  // A plot from x=50 spanning 400px with 5 periods: points every 100px.
  const at = (x: number) => nearestIndex(x, 50, 400, 5);

  it("snaps to the closest point", () => {
    expect(at(50)).toBe(0);
    expect(at(90)).toBe(0);
    expect(at(110)).toBe(1);
    expect(at(250)).toBe(2);
    expect(at(450)).toBe(4);
  });

  it("clamps outside the plot", () => {
    expect(at(-100)).toBe(0);
    expect(at(9999)).toBe(4);
  });

  it("has only one answer for a single period", () => {
    expect(nearestIndex(123, 50, 400, 1)).toBe(0);
    expect(nearestIndex(123, 50, 400, 0)).toBe(0);
  });
});

describe("axis labels", () => {
  it("thins labels only when they would collide", () => {
    // 400px at 58px per label fits 6, so 4 periods all get one.
    expect(labelStride(4, 400)).toBe(1);
    // 20 periods in 400px cannot all be drawn.
    expect(labelStride(20, 400)).toBe(4);
    expect(labelStride(1, 400)).toBe(1);
  });

  it("always anchors the range with the first and last label", () => {
    expect(showsLabel(0, 20, 4)).toBe(true);
    expect(showsLabel(19, 20, 4)).toBe(true);
    expect(showsLabel(8, 20, 4)).toBe(true);
    expect(showsLabel(7, 20, 4)).toBe(false);
  });

  it("keeps an axis readable at every magnitude", () => {
    expect(axisLabel(0)).toBe("0");
    expect(axisLabel(4.25)).toBe("4.3");
    expect(axisLabel(42)).toBe("42");
    expect(axisLabel(1_250)).toBe("1.3k");
    expect(axisLabel(24_000)).toBe("24k");
    expect(axisLabel(2_500_000)).toBe("2.5M");
    expect(axisLabel(-1_250)).toBe("-1.3k");
  });
});

describe("formatValue", () => {
  it("shows more precision for small numbers, and the unit when there is one", () => {
    // Formatting follows the viewer's locale, so the expectations are built the
    // same way rather than assuming a decimal separator.
    const local = (value: number, digits: number) =>
      value.toLocaleString(undefined, { maximumFractionDigits: digits });

    expect(formatValue(543.76, "m")).toBe(`${local(543.8, 1)} m`);
    expect(formatValue(4.256)).toBe(local(4.26, 2));
    expect(formatValue(0)).toBe("0");
    expect(formatValue(12, null)).toBe("12");
  });
});

describe("seriesMax", () => {
  const two = series(
    [
      ["2026/06", { beam: 20, wall: 411 }],
      ["2026/07", { beam: 25, wall: 400 }],
    ],
    ["beam", "wall"],
  );

  it("bounds stacked marks by the period total", () => {
    expect(seriesMax(two, "stacked")).toBe(431);
  });

  it("bounds independent lines by the largest single value", () => {
    // A lower ceiling, so the lines use more of the plot.
    expect(seriesMax(two, "lines")).toBe(411);
  });

  it("is zero for an empty series", () => {
    const empty = series([], []);

    expect(seriesMax(empty, "stacked")).toBe(0);
    expect(seriesMax(empty, "lines")).toBe(0);
  });
});
