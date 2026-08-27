import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { leafOf, type Grid } from "./analytics.js";
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
} from "./chart-model.js";
import { EmptyState, useElementWidth } from "./ui.js";

/**
 * The chart primitives every surface in this package draws with.
 *
 * One frame handles measurement, axes, the hover guide, the tooltip and the
 * legend; the individual charts only describe their marks. That is what keeps
 * an area and a bar chart looking like the same product, and it is why there is
 * no second implementation of any of it.
 */

export const SERIES_COLOURS = [
  "#3b82f6",
  "#8b5cf6",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#10b981",
  "#64748b",
] as const;

export function colourFor(index: number): string {
  return SERIES_COLOURS[index % SERIES_COLOURS.length];
}

const HEIGHT = 248;
const PAD = { top: 16, right: 14, bottom: 34, left: 56 } as const;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

interface Geometry {
  width: number;
  plotWidth: number;
  x: (index: number) => number;
  y: (value: number) => number;
  top: number;
  bottom: number;
  band: number;
}

interface FrameChildProps {
  geometry: Geometry;
  /** The colour for a key, honouring any explicit mapping. */
  colour: (key: string, index: number) => string;
  /** Keys still shown, after the legend's toggles. */
  keys: string[];
  hovered: number | null;
  /** The key under the pointer in the legend, if any. */
  focused: string | null;
  gradientId: (index: number) => string;
}

let frameSequence = 0;

/**
 * Axes, hover and legend, once.
 *
 * The mark-drawing is handed back to the caller so a stacked area and a stacked
 * bar chart share every part a reader interacts with.
 */
function ChartFrame({
  series: input,
  label,
  ariaLabel,
  colours,
  mode,
  selectedPeriod,
  onSelect,
  children,
}: {
  series: StackedSeries;
  label: string;
  ariaLabel?: string;
  /** Stacked marks are bounded by totals, lines by the largest single value. */
  mode: "stacked" | "lines";
  /** Explicit colour per key, where a key already means something visually. */
  colours?: Record<string, string>;
  selectedPeriod?: string | null;
  onSelect?: (period: string) => void;
  children: (props: FrameChildProps) => ReactNode;
}) {
  const [attach, width] = useElementWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [grown, setGrown] = useState(false);
  const svg = useRef<SVGSVGElement | null>(null);

  // A distinct id per instance, so two charts on one page cannot share gradients.
  const uid = useMemo(() => ++frameSequence, []);

  const series = useMemo(() => {
    const visible = input.keys.filter((key) => !hidden.has(key));

    const periods = input.periods.map((period) => {
      const values: Record<string, number> = {};
      let total = 0;

      for (const key of visible) {
        values[key] = period.values[key] ?? 0;
        total += values[key];
      }

      return { ...period, values, total };
    });

    return trimEmpty({
      keys: visible,
      periods,
      max: periods.reduce((peak, period) => Math.max(peak, period.total), 0),
      unit: input.unit,
    });
  }, [input, hidden]);

  // Grow the plot in once, after the first paint.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (input.periods.length === 0 || input.keys.length === 0) {
    return (
      <EmptyState
        title={`No ${label.toLowerCase()} in this range`}
        hint="Nothing has been recorded for the chosen period and grouping."
      />
    );
  }

  const WIDTH = Math.max(width, 320);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const count = series.periods.length;

  const reach = seriesMax(series, mode);
  const top = axisMax(reach);
  const ticks = niceTicks(reach);
  const band = plotWidth / Math.max(count, 1);

  const geometry: Geometry = {
    width: WIDTH,
    plotWidth,
    x: (index) =>
      count === 1
        ? PAD.left + plotWidth / 2
        : PAD.left + (index / (count - 1)) * plotWidth,
    y: (value) => PAD.top + PLOT_H - (top === 0 ? 0 : (value / top) * PLOT_H),
    top: PAD.top,
    bottom: PAD.top + PLOT_H,
    band,
  };

  const colour = (key: string, index: number) =>
    colours?.[key] ?? colourFor(index);

  const stride = labelStride(count, plotWidth);
  const point = hovered == null ? null : series.periods[hovered];
  const clipId = `chart-clip-${uid}`;

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;

    // The svg is drawn at its measured size, so client pixels are user units.
    setHovered(
      nearestIndex(event.clientX - box.left, PAD.left, plotWidth, count),
    );
  }

  return (
    <div className="flex flex-col gap-2.5" ref={attach}>
      <div className="relative">
        <svg
          ref={svg}
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="max-w-full touch-none"
          role="img"
          aria-label={ariaLabel ?? `${label} across ${count} periods`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHovered(null)}
          onClick={() => {
            if (onSelect && point) onSelect(point.period);
          }}
          style={{ cursor: onSelect ? "pointer" : "default" }}
        >
          <defs>
            {series.keys.map((key, index) => (
              <linearGradient
                key={key}
                id={`chart-fill-${uid}-${index}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={colour(key, index)}
                  stopOpacity={0.92}
                />
                <stop
                  offset="100%"
                  stopColor={colour(key, index)}
                  stopOpacity={0.28}
                />
              </linearGradient>
            ))}
            <clipPath id={clipId}>
              <rect
                x={PAD.left}
                y={0}
                height={HEIGHT}
                width={grown ? plotWidth : 0}
                style={{
                  transition: "width 520ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </clipPath>
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={geometry.y(tick)}
                y2={geometry.y(tick)}
                className={
                  tick === 0
                    ? "stroke-slate-300 dark:stroke-slate-600"
                    : "stroke-slate-200/70 dark:stroke-slate-700/60"
                }
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={geometry.y(tick) + 3.5}
                textAnchor="end"
                className="fill-slate-400 text-[10px] tabular-nums dark:fill-slate-500"
              >
                {axisLabel(tick)}
              </text>
            </g>
          ))}

          {series.unit && (
            <text
              x={PAD.left - 8}
              y={PAD.top - 5}
              textAnchor="end"
              className="fill-slate-400 text-[9px] dark:fill-slate-500"
            >
              {series.unit}
            </text>
          )}

          <g clipPath={`url(#${clipId})`}>
            {children({
              geometry,
              colour,
              keys: series.keys,
              hovered,
              focused,
              gradientId: (index) => `chart-fill-${uid}-${index}`,
            })}
          </g>

          {selectedPeriod != null &&
            (() => {
              const at = series.periods.findIndex(
                (period) => period.period === selectedPeriod,
              );

              return at < 0 ? null : (
                <line
                  x1={geometry.x(at)}
                  x2={geometry.x(at)}
                  y1={PAD.top}
                  y2={geometry.bottom}
                  className="stroke-slate-900/40 dark:stroke-slate-100/40"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
              );
            })()}

          {hovered != null && (
            <g className="pointer-events-none">
              <line
                x1={geometry.x(hovered)}
                x2={geometry.x(hovered)}
                y1={PAD.top - 4}
                y2={geometry.bottom}
                className="stroke-slate-500 dark:stroke-slate-300"
                strokeWidth={1}
                style={{ transition: "all 110ms ease-out" }}
              />
              {series.keys.map((key, index) => {
                const at =
                  mode === "stacked"
                    ? stackTops(series)[hovered][key]
                    : (series.periods[hovered].values[key] ?? 0);

                return (
                  <circle
                    key={key}
                    cx={geometry.x(hovered)}
                    cy={geometry.y(at)}
                    r={3}
                    fill={colour(key, index)}
                    className="stroke-white dark:stroke-slate-900"
                    strokeWidth={1.5}
                    style={{ transition: "all 110ms ease-out" }}
                  />
                );
              })}
            </g>
          )}

          {series.periods.map((period, index) => (
            <text
              key={period.period}
              x={geometry.x(index)}
              y={HEIGHT - 11}
              // The edge labels are anchored inward, or half of each would be
              // drawn outside the plot.
              textAnchor={
                index === 0
                  ? "start"
                  : index === count - 1
                    ? "end"
                    : "middle"
              }
              className={`text-[10px] ${
                index === hovered
                  ? "fill-slate-900 font-semibold dark:fill-slate-100"
                  : "fill-slate-400 dark:fill-slate-500"
              }`}
              style={{ transition: "fill 110ms ease-out" }}
            >
              {showsLabel(index, count, stride) ? period.period : ""}
            </text>
          ))}
        </svg>

        {point && (
          <div
            className="pointer-events-none absolute z-10 min-w-[10rem] rounded-lg border border-slate-200 bg-white/95 px-2.5 py-2 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95"
            style={{
              left: Math.min(
                Math.max(geometry.x(hovered ?? 0) + 12, 8),
                Math.max(WIDTH - 180, 8),
              ),
              top: PAD.top,
            }}
          >
            <div className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">
              {point.period}
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              {[...series.keys].reverse().map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: colour(
                          key,
                          series.keys.indexOf(key),
                        ),
                      }}
                    />
                    <span className="truncate text-slate-600 dark:text-slate-300">
                      {leafOf(key)}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {formatValue(point.values[key] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
            {series.keys.length > 1 && mode === "stacked" && (
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-slate-200 pt-1 text-[11px] dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Total</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatValue(point.total, series.unit)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {input.keys.map((key, index) => {
          const off = hidden.has(key);

          return (
            <button
              key={key}
              type="button"
              title={`${key}${off ? " — hidden, click to show" : " — click to hide"}`}
              onMouseEnter={() => setFocused(key)}
              onMouseLeave={() => setFocused(null)}
              onClick={() =>
                setHidden((current) => {
                  const next = new Set(current);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
                off
                  ? "text-slate-400 line-through dark:text-slate-600"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-black/10 transition-opacity"
                style={{
                  backgroundColor: colour(key, index),
                  opacity: off ? 0.3 : 1,
                }}
              />
              {leafOf(key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Opacity for a band, given what the legend is pointing at. */
function bandOpacity(key: string, focused: string | null): number {
  if (!focused) return 1;
  return focused === key ? 1 : 0.25;
}

/**
 * One line per series over periods.
 *
 * Unstacked, so each line reads as its own quantity and the categories can be
 * compared directly. Straight segments, never a spline: the facts underneath are
 * discrete revisions, and a curve would invent values between them.
 */
export function LineChart({
  series,
  label,
  colours,
  selectedPeriod,
  onSelect,
}: {
  series: StackedSeries;
  label: string;
  colours?: Record<string, string>;
  selectedPeriod?: string | null;
  onSelect?: (period: string) => void;
}) {
  return (
    <ChartFrame
      series={series}
      label={label}
      colours={colours}
      mode="lines"
      selectedPeriod={selectedPeriod}
      onSelect={onSelect}
    >
      {({ geometry, colour, keys, focused }) =>
        keys.map((key, index) => {
          const points = series.periods.map(
            (period, i) =>
              `${geometry.x(i)},${geometry.y(period.values[key] ?? 0)}`,
          );

          const dimmed = focused != null && focused !== key;

          return (
            <g
              key={key}
              style={{
                opacity: dimmed ? 0.2 : 1,
                transition: "opacity 140ms ease-out",
              }}
            >
              <polyline
                points={points.join(" ")}
                fill="none"
                stroke={colour(key, index)}
                strokeWidth={focused === key ? 2.75 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ transition: "stroke-width 140ms ease-out" }}
              />
              {series.periods.map((period, i) => (
                <circle
                  key={period.period}
                  cx={geometry.x(i)}
                  cy={geometry.y(period.values[key] ?? 0)}
                  r={2.5}
                  fill={colour(key, index)}
                  className="stroke-white dark:stroke-slate-900"
                  strokeWidth={1.25}
                />
              ))}
            </g>
          );
        })
      }
    </ChartFrame>
  );
}

/** A stacked bar per period — for counts, where an area would over-claim. */
export function StackedBarChart({
  series,
  label,
  colours,
  selectedPeriod,
  onSelect,
}: {
  series: StackedSeries;
  label: string;
  colours?: Record<string, string>;
  selectedPeriod?: string | null;
  onSelect?: (period: string) => void;
}) {
  return (
    <ChartFrame
      series={series}
      label={label}
      colours={colours}
      mode="stacked"
      selectedPeriod={selectedPeriod}
      onSelect={onSelect}
    >
      {({ geometry, colour, keys, hovered, focused, gradientId }) => {
        const tops = stackTops({ ...series, keys });
        const barWidth = Math.min(geometry.band * 0.58, 56);

        return series.periods.map((period, i) => (
          <g key={period.period}>
            {keys.map((key, index) => {
              const value = period.values[key] ?? 0;
              if (value === 0) return null;

              const upper = geometry.y(tops[i][key]);
              const lower = geometry.y(tops[i][key] - value);

              return (
                <rect
                  key={key}
                  x={geometry.x(i) - barWidth / 2}
                  y={upper}
                  width={barWidth}
                  height={Math.max(lower - upper, 1)}
                  fill={`url(#${gradientId(index)})`}
                  stroke={colour(key, index)}
                  strokeWidth={1}
                  rx={2}
                  style={{
                    opacity:
                      bandOpacity(key, focused) * (hovered === i ? 1 : 0.88),
                    transition: "opacity 140ms ease-out",
                  }}
                />
              );
            })}
          </g>
        ));
      }}
    </ChartFrame>
  );
}

/**
 * A period by key grid, shaded by magnitude.
 *
 * The view that answers "which trade was volatile when" — which a single time
 * series cannot, because it needs two axes and a magnitude.
 */
export function Heatmap({ grid, label }: { grid: Grid; label: string }) {
  const [hover, setHover] = useState<{ key: string; period: string } | null>(
    null,
  );

  if (grid.periods.length === 0 || grid.keys.length === 0) {
    return (
      <EmptyState
        title="Nothing moved in this range"
        hint="A heatmap needs at least one period where something changed."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="overflow-x-auto">
        <table
          className="border-separate text-xs"
          style={{ borderSpacing: "2px" }}
          onMouseLeave={() => setHover(null)}
        >
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                {label}
              </th>
              {grid.periods.map((period) => (
                <th
                  key={period}
                  className={`px-1.5 py-1 text-[10px] font-medium transition-colors ${
                    hover?.period === period
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.keys.map((key) => (
              <tr key={key}>
                <td
                  title={key}
                  className={`sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 font-medium transition-colors dark:bg-slate-900 ${
                    hover?.key === key
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {leafOf(key)}
                </td>
                {grid.periods.map((period) => {
                  const value = grid.cells.get(`${period} ${key}`);
                  const intensity =
                    value == null || grid.max === 0
                      ? 0
                      : Math.abs(value) / grid.max;

                  // Growth reads warm, shrinkage cool, so direction is legible
                  // before the number is.
                  const hue = (value ?? 0) < 0 ? 205 : 24;
                  const lit =
                    hover?.key === key || hover?.period === period;

                  return (
                    <td
                      key={period}
                      onMouseEnter={() => setHover({ key, period })}
                      title={
                        value == null
                          ? `${leafOf(key)} · ${period}: unchanged`
                          : `${leafOf(key)} · ${period}: ${value > 0 ? "+" : ""}${formatValue(value)}`
                      }
                      className="rounded px-1.5 py-1 text-center font-mono text-[10px] tabular-nums transition-all duration-150"
                      style={{
                        backgroundColor:
                          intensity === 0
                            ? "transparent"
                            : `hsl(${hue} 88% ${86 - intensity * 44}% / ${0.28 + intensity * 0.72})`,
                        color: intensity > 0.55 ? "white" : undefined,
                        outline: lit
                          ? "1px solid rgb(100 116 139 / 0.45)"
                          : undefined,
                        transform:
                          hover?.key === key && hover.period === period
                            ? "scale(1.06)"
                            : undefined,
                      }}
                    >
                      {value == null ? "" : axisLabel(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
        <span>shrank</span>
        <span
          aria-hidden
          className="inline-block h-2 w-20 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, hsl(205 88% 46%), hsl(205 88% 86% / .3), hsl(24 88% 86% / .3), hsl(24 88% 46%))",
          }}
        />
        <span>grew</span>
        <span className="ml-1">— intensity is the size of the move</span>
      </div>
    </div>
  );
}
