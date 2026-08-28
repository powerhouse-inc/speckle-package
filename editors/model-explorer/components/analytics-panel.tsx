import { useState } from "react";
import {
  gridByDimension,
  leafOf,
  stackByDimension,
  unitFor,
  type Granularity,
} from "../../shared/analytics.js";
import { Heatmap, LineChart } from "../../shared/charts.js";
import { formatRelative } from "../../shared/format.js";
import { Banner, Button, Cell, Chip, EmptyState, Row, Table } from "../../shared/ui.js";
import { useHotspots, useSeries } from "../../shared/use-analytics.js";

const GRANULARITIES: readonly Granularity[] = ["daily", "weekly", "monthly"];

const MEASURES = [
  { metric: "Volume", label: "Volume" },
  { metric: "Area", label: "Area" },
  { metric: "Elements", label: "Elements" },
] as const;

/** Volume is in the recorded length unit cubed, not in the unit itself. */
function withUnit(
  series: ReturnType<typeof stackByDimension>,
  metric: string,
): ReturnType<typeof stackByDimension> {
  return { ...series, unit: unitFor(metric, series.unit) };
}

function Switch<T extends string>({
  options,
  value,
  onChange,
  labelOf = (option: T) => option,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labelOf?: (option: T) => string;
}) {
  return (
    <span className="flex items-center gap-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
            value === option
              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          {labelOf(option)}
        </button>
      ))}
    </span>
  );
}

/**
 * The analytics views for one mirrored project.
 *
 * Everything here is read over GraphQL from read models the Speckle Analytics
 * processor maintains in switchboard. That is the difference from the *By
 * revision* tab, which is a pure function of the open document: these have a
 * calendar axis, and they can be asked questions a single document cannot
 * answer — such as which elements keep being touched.
 */
export function AnalyticsPanel({
  projectId,
  projectDocumentId,
  from,
  to,
}: {
  projectId: string;
  projectDocumentId: string;
  from: string;
  to: string;
}) {
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [metric, setMetric] = useState<string>("Volume");
  const [minTouches, setMinTouches] = useState(2);

  const project = { name: "project", select: `speckle/project/${projectId}`, lod: 3 };

  const masses = useSeries({
    start: from,
    end: to,
    granularity,
    metrics: [metric],
    dimensions: [
      { name: "category", select: "speckle/category", lod: 5 },
      project,
    ],
  });

  const activity = useSeries({
    start: from,
    end: to,
    granularity,
    metrics: ["Revisions"],
    dimensions: [{ name: "tool", select: "speckle/tool", lod: 3 }, project],
  });

  const churn = useSeries({
    start: from,
    end: to,
    granularity,
    metrics: ["Added", "Modified", "Removed"],
    dimensions: [
      { name: "category", select: "speckle/category", lod: 5 },
      project,
    ],
  });

  const hotspots = useHotspots(projectDocumentId, minTouches, 20);

  const failure =
    masses.error ?? activity.error ?? churn.error ?? hotspots.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Period
          </span>
          <Switch
            options={GRANULARITIES}
            value={granularity}
            onChange={setGranularity}
          />
        </span>

        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Quantity
          </span>
          <Switch
            options={MEASURES.map((m) => m.metric)}
            value={metric}
            onChange={setMetric}
          />
        </span>

        {(masses.loading || activity.loading || churn.loading) && (
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
          {metric} in the model over time
        </h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          The quantity actually standing in the model at the end of each period,
          per category — read as a cumulative of the movements the sync recorded.
        </p>
        <LineChart
          series={withUnit(
            stackByDimension(masses.data, "category", true),
            metric,
          )}
          label={metric}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          Revisions to date
        </h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Revisions accumulated over time, split by the tool they came from. A
          cumulative count is a stock, so the line never claims a rate between
          two periods.
        </p>
        <LineChart
          series={withUnit(
            stackByDimension(activity.data, "tool", true),
            "Revisions",
          )}
          label="Revisions"
        />
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
          Where the churn was
        </h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Elements added, modified or removed per category per period. A hot row
          is a trade that was still moving.
        </p>
        <Heatmap grid={gridByDimension(churn.data, "category")} label="Category" />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Elements that keep being touched
          </h4>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            at least
            <Button
              variant="ghost"
              onClick={() => setMinTouches(Math.max(2, minTouches - 1))}
              title="Lower the threshold"
            >
              −
            </Button>
            <span className="font-mono">{minTouches}</span>
            <Button
              variant="ghost"
              onClick={() => setMinTouches(minTouches + 1)}
              title="Raise the threshold"
            >
              +
            </Button>
            touches
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Ranked by how many revisions touched the same element. Identity comes
          from the authoring tool, so an element stays itself across edits — this
          is the question the analytics store cannot answer, so it is served by
          this package's own subgraph.
        </p>

        {hotspots.data.length === 0 ? (
          <EmptyState
            title="No element was touched that often"
            hint="Either the history is short, or every change landed somewhere new."
          />
        ) : (
          <Table
            headers={[
              "Element",
              "Category",
              { label: "Touches", align: "right" },
              { label: "Added", align: "right" },
              { label: "Modified", align: "right" },
              { label: "Removed", align: "right" },
              "First detected",
              "Last detected",
            ]}
          >
            {hotspots.data.map((spot) => (
              <Row key={spot.identity}>
                <Cell
                  mono
                  title={spot.identity}
                  className="font-medium text-slate-900 dark:text-slate-100"
                >
                  {spot.identity.replace(/^app:/, "")}
                </Cell>
                <Cell>{leafOf(spot.speckleType.replace(/\./g, "/"))}</Cell>
                <Cell align="right" mono>
                  <Chip>{spot.touches}</Chip>
                </Cell>
                <Cell align="right" mono>
                  {spot.added > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{spot.added}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">—</span>
                  )}
                </Cell>
                <Cell align="right" mono>
                  {spot.modified > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      ~{spot.modified}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">—</span>
                  )}
                </Cell>
                <Cell align="right" mono>
                  {spot.removed > 0 ? (
                    <span className="text-red-600 dark:text-red-400">
                      −{spot.removed}
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">—</span>
                  )}
                </Cell>
                <Cell className="text-slate-500 dark:text-slate-400">
                  {formatRelative(spot.firstDetectedAt)}
                </Cell>
                <Cell className="text-slate-500 dark:text-slate-400">
                  {formatRelative(spot.lastDetectedAt)}
                </Cell>
              </Row>
            ))}
          </Table>
        )}
      </section>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Read over GraphQL from switchboard: quantities and activity from{" "}
        <span className="font-mono">/graphql/analytics</span>, hot spots from{" "}
        <span className="font-mono">/graphql/speckle-hotspots</span>. Nothing is
        recomputed in the browser.
      </p>
    </div>
  );
}
