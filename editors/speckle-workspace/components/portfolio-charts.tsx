import { useState } from "react";
import {
  stackByDimension,
  unitFor,
  type Granularity,
} from "../../shared/analytics.js";
import { LineChart } from "../../shared/charts.js";
import { Banner } from "../../shared/ui.js";
import { useSeries } from "../../shared/use-analytics.js";

const GRANULARITIES: readonly Granularity[] = ["weekly", "monthly", "quarterly"];

/**
 * The portfolio view: every mirrored project on one axis.
 *
 * This is the analysis a single document cannot produce, and the reason the read
 * models live in switchboard rather than being derived per editor — the series
 * are already aggregated across projects when they arrive.
 */
export function PortfolioCharts({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const [granularity, setGranularity] = useState<Granularity>("monthly");

  const volume = useSeries({
    start: from,
    end: to,
    granularity,
    metrics: ["Volume"],
    dimensions: [{ name: "project", select: "speckle/project", lod: 3 }],
  });

  const activity = useSeries({
    start: from,
    end: to,
    granularity,
    metrics: ["Revisions"],
    dimensions: [{ name: "project", select: "speckle/project", lod: 3 }],
  });

  const failure = volume.error ?? activity.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1">
          {GRANULARITIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setGranularity(option)}
              className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                granularity === option
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {option}
            </button>
          ))}
        </span>

        {(volume.loading || activity.loading) && (
          <span className="animate-pulse text-[11px] text-slate-400 dark:text-slate-500">
            querying…
          </span>
        )}
      </div>

      {failure && (
        <Banner tone="error">
          <strong>The analytics query failed.</strong> {failure}
        </Banner>
      )}

      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          Volume standing in each project
        </h4>
        <LineChart
          series={(() => {
            const series = stackByDimension(volume.data, "project", true);
            return { ...series, unit: unitFor("Volume", series.unit) };
          })()}
          label="Volume"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          Revisions to date per project
        </h4>
        <LineChart
          series={(() => {
            const series = stackByDimension(activity.data, "project", true);
            return { ...series, unit: unitFor("Revisions", series.unit) };
          })()}
          label="Revisions"
        />
      </section>
    </div>
  );
}
