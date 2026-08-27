/**
 * The data shape every chart in this package draws, and the geometry maths
 * behind it.
 *
 * Kept apart from the components so the parts that can be wrong — where a point
 * sits, which period the pointer is over, what a readable axis looks like — are
 * testable without a DOM.
 */

export interface StackedPeriod {
  /** Axis label, e.g. `2026/07` or a revision hash. */
  period: string;
  /** ISO timestamp or any secondary label, shown in the tooltip. */
  start: string;
  values: Record<string, number>;
  total: number;
}

export interface StackedSeries {
  /** Series keys, biggest total last so the stack reads bottom-light. */
  keys: string[];
  periods: StackedPeriod[];
  max: number;
  unit: string | null;
}

export const EMPTY_SERIES: StackedSeries = {
  keys: [],
  periods: [],
  max: 0,
  unit: null,
};

/**
 * Drops leading and trailing periods where nothing stands.
 *
 * A query window is padded so the first and last periods are whole, which
 * otherwise spends a quarter of the plot drawing a flat zero.
 */
export function trimEmpty(series: StackedSeries): StackedSeries {
  const carries = (period: StackedPeriod) =>
    period.total !== 0 ||
    Object.values(period.values).some((value) => value !== 0);

  let first = 0;
  let last = series.periods.length - 1;

  while (first <= last && !carries(series.periods[first])) first++;
  while (last >= first && !carries(series.periods[last])) last--;

  if (first > last) return { ...series, periods: [], max: 0 };

  const periods = series.periods.slice(first, last + 1);

  return {
    ...series,
    periods,
    max: periods.reduce((peak, period) => Math.max(peak, period.total), 0),
  };
}

/** Cumulative tops per key, per period, so each band sits on the one below. */
export function stackTops(series: StackedSeries): Record<string, number>[] {
  return series.periods.map((period) => {
    let running = 0;
    const tops: Record<string, number> = {};

    for (const key of series.keys) {
      running += period.values[key] ?? 0;
      tops[key] = running;
    }

    return tops;
  });
}

/**
 * Axis ticks on round numbers.
 *
 * An axis reading 0 / 289 / 578 is arithmetically true and useless; 0 / 200 /
 * 400 / 600 is what a reader can compare against.
 */
export function niceTicks(max: number, count = 5): number[] {
  if (max <= 0) return [0];

  // The smallest round step that still fits within the tick budget, so the axis
  // top sits just above the data rather than a long way above it.
  const magnitude = 10 ** Math.floor(Math.log10(max / count));

  for (const factor of [1, 2, 2.5, 5, 10, 20, 25, 50, 100]) {
    const step = factor * magnitude;

    if (Math.ceil(max / step) > count) continue;

    const ticks: number[] = [];

    for (let i = 0; i <= Math.ceil(max / step); i++) {
      ticks.push(Math.round(i * step * 1e6) / 1e6);
    }

    return ticks;
  }

  return [0, max];
}

/**
 * The largest value the plot has to reach.
 *
 * Stacked marks are bounded by the period totals; independent lines by the
 * largest single value, which is a lower ceiling and therefore uses more of the
 * plot.
 */
export function seriesMax(
  series: StackedSeries,
  mode: "stacked" | "lines",
): number {
  if (mode === "stacked") {
    return series.periods.reduce((peak, period) => Math.max(peak, period.total), 0);
  }

  let peak = 0;

  for (const period of series.periods) {
    for (const key of series.keys) {
      peak = Math.max(peak, period.values[key] ?? 0);
    }
  }

  return peak;
}

/** The upper bound of the plot: the top tick, so the marks never clip. */
export function axisMax(max: number, count = 5): number {
  const ticks = niceTicks(max, count);
  return Math.max(ticks[ticks.length - 1], max);
}

/**
 * The period the pointer is over.
 *
 * Snapping to the nearest point rather than requiring a hit on the line is what
 * makes a chart feel responsive instead of fiddly.
 */
export function nearestIndex(
  pointerX: number,
  plotLeft: number,
  plotWidth: number,
  count: number,
): number {
  if (count <= 1) return 0;

  const ratio = (pointerX - plotLeft) / Math.max(plotWidth, 1);
  const index = Math.round(ratio * (count - 1));

  return Math.min(Math.max(index, 0), count - 1);
}

/**
 * Which axis labels to draw.
 *
 * Every label when they fit, otherwise every nth — and always the first and
 * last, because those anchor the range.
 */
export function labelStride(count: number, plotWidth: number, labelPx = 58): number {
  if (count <= 1) return 1;

  const fits = Math.max(Math.floor(plotWidth / labelPx), 1);

  return Math.max(Math.ceil(count / fits), 1);
}

export function showsLabel(index: number, count: number, stride: number): boolean {
  return index === 0 || index === count - 1 || index % stride === 0;
}

export function formatValue(value: number, unit?: string | null): string {
  const shown = value.toLocaleString(undefined, {
    maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1,
  });

  return unit ? `${shown} ${unit}` : shown;
}

export function axisLabel(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  if (abs >= 10) return value.toFixed(0);
  if (abs === 0) return "0";

  return value.toFixed(1);
}
