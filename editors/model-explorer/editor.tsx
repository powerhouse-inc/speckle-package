import { DocumentToolbar } from "@powerhousedao/design-system/connect/index";
import { useSelectedSpeckleProjectDocument } from "document-models/speckle-project";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadText,
  formatDateTime,
  formatQuantity,
  formatRelative,
  shortHash,
  toCsv,
} from "../shared/format.js";
import { DEFAULT_SPECKLE_BASE } from "../shared/speckle.js";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  KpiTile,
  Toggle,
} from "../shared/ui.js";
import { LineChart, StackedBarChart } from "../shared/charts.js";
import { CHANGE_COLOURS } from "./components/live-viewer.js";
import { AnalyticsPanel } from "./components/analytics-panel.js";
import { ChangePanel } from "./components/change-panel.js";
import { MassTable } from "./components/mass-table.js";
import { RevisionRail } from "./components/revision-rail.js";
import { Viewer } from "./components/viewer.js";
import {
  MEASURES,
  highlightOf,
  MEASURE_LABELS,
  categorySeries,
  changeForRevision,
  changeTotal,
  churnSeries,
  churnToStacked,
  defaultModelId,
  defaultVersionId,
  massRows,
  massSummary,
  modelOf,
  previousRevision,
  revisionOf,
  revisionsForModel,
  trendToStacked,
  vanishedTypes,
} from "./logic.js";
import type { IsolationMode, Measure } from "./logic.js";

type Tab = "MASSES" | "CHANGES" | "TRENDS" | "ANALYTICS";

export default function Editor() {
  const [document] = useSelectedSpeckleProjectDocument();
  const state = document.state.global;

  const [modelId, setModelId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [mode, setMode] = useState<IsolationMode>("ALL");
  const [tab, setTab] = useState<Tab>("MASSES");
  const [measure, setMeasure] = useState<Measure>("VOLUME");
  const [showDeltas, setShowDeltas] = useState(true);

  const activeModelId = modelId ?? defaultModelId(state);
  const model = modelOf(state, activeModelId);
  const revisions = useMemo(
    () => revisionsForModel(state, activeModelId),
    [state, activeModelId],
  );

  const activeVersionId =
    versionId && revisions.some((entry) => entry.versionId === versionId)
      ? versionId
      : defaultVersionId(revisions, model);

  const revision = revisionOf(revisions, activeVersionId);
  const previous = previousRevision(revisions, activeVersionId);
  const change = changeForRevision(state, activeVersionId);

  const summary = massSummary(revision);
  const previousSummary = massSummary(previous);
  const rows = useMemo(() => massRows(revision, change), [revision, change]);
  const analyticsWindow = useMemo(() => {
    const dates = revisions
      .map((revision) => revision.createdAt ?? revision.syncedAt)
      .filter((value): value is string => Boolean(value))
      .sort();

    const first = dates[0];
    const last = dates[dates.length - 1];

    // A month of padding on each side, so the first and last periods are whole.
    const pad = (iso: string, months: number) => {
      const at = new Date(iso);
      at.setUTCMonth(at.getUTCMonth() + months);
      return at.toISOString().slice(0, 10);
    };

    return first && last
      ? { from: pad(first, -1), to: pad(last, 1) }
      : { from: "2026-01-01", to: "2027-01-01" };
  }, [revisions]);

  const series = useMemo(
    () => categorySeries(revisions, measure),
    [revisions, measure],
  );
  const churn = useMemo(
    () => churnSeries(revisions, state.changes),
    [revisions, state.changes],
  );
  const vanished = vanishedTypes(revision, change);

  // Isolation only means something while a change is on screen.
  const effectiveMode: IsolationMode = change ? mode : "ALL";
  const highlight = useMemo(() => highlightOf(change), [change]);

  const index = revisions.findIndex(
    (entry) => entry.versionId === activeVersionId,
  );

  const step = useCallback(
    (offset: number) => {
      const next = revisions.at(index + offset);
      if (next) setVersionId(next.versionId);
    },
    [revisions, index],
  );

  // ← and → walk the timeline, which is how you actually compare revisions.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      // Never hijack typing.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(1); // Older: the list runs newest first.
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(-1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step]);

  const serverUrl = state.serverUrl ?? DEFAULT_SPECKLE_BASE;

  function exportMasses() {
    if (!revision) return;

    downloadText(
      `masses-${state.projectId ?? "project"}-${revision.versionId}.csv`,
      toCsv(
        [
          "speckleType",
          "objectCount",
          "unit",
          "volume",
          "area",
          "length",
          "countDelta",
          "volumeDelta",
          "areaDelta",
        ],
        rows.map((row) => [
          row.speckleType,
          row.objectCount,
          row.unit ?? "",
          row.volume ?? "",
          row.area ?? "",
          row.length ?? "",
          row.countDelta ?? "",
          row.volumeDelta ?? "",
          row.areaDelta ?? "",
        ]),
      ),
    );
  }

  if (!state.projectId) {
    return (
      <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <DocumentToolbar />
        <div className="mx-auto max-w-3xl p-6">
          <EmptyState
            title="Nothing mirrored here yet"
            hint="This document is the Powerhouse mirror of a Speckle project. Point a Sync Console document at a project and run a sync — the models, revisions, quantities and change history land here."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <DocumentToolbar />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4">
        {/* ------------------------------------------------------- header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">
              {state.name ?? state.projectId}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Chip mono title="Speckle project id">
                {state.projectId}
              </Chip>
              {state.visibility && <Chip>{state.visibility.toLowerCase()}</Chip>}
              <span className="truncate">{serverUrl}</span>
              <span title={formatDateTime(state.syncedAt)}>
                · synced {formatRelative(state.syncedAt)}
              </span>
            </div>
            {state.description && (
              <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
                {state.description}
              </p>
            )}
          </div>

          {state.models.length > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              {state.models.map((entry) => (
                <button
                  key={entry.speckleModelId}
                  type="button"
                  onClick={() => {
                    setModelId(entry.speckleModelId);
                    setVersionId(null);
                    setMode("ALL");
                  }}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    entry.speckleModelId === activeModelId
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {entry.displayName ?? entry.name}
                  <span className="ml-1.5 font-mono opacity-60">
                    {entry.versionCount}
                  </span>
                </button>
              ))}
            </div>
          )}
        </header>

        {/* ---------------------------------------------------------- KPIs */}
        <div className="flex flex-wrap gap-2">
          <KpiTile
            label="Revisions mirrored"
            value={revisions.length.toLocaleString()}
            hint={
              index >= 0
                ? `viewing #${revisions.length - index} of ${revisions.length}`
                : undefined
            }
          />
          <KpiTile
            label="Objects in revision"
            value={summary.objectCount.toLocaleString()}
            delta={
              previous
                ? summary.objectCount - previousSummary.objectCount
                : undefined
            }
            hint={`${summary.categoryCount} categories`}
          />
          <KpiTile
            label="Volume"
            value={formatQuantity(summary.volume)}
            delta={
              summary.volume != null && previousSummary.volume != null
                ? Math.round(
                    (summary.volume - previousSummary.volume) * 1000,
                  ) / 1000
                : undefined
            }
            hint={rows[0]?.unit ? `${rows[0].unit}³` : undefined}
          />
          <KpiTile
            label="Area"
            value={formatQuantity(summary.area)}
            delta={
              summary.area != null && previousSummary.area != null
                ? Math.round((summary.area - previousSummary.area) * 1000) / 1000
                : undefined
            }
            hint={rows[0]?.unit ? `${rows[0].unit}²` : undefined}
          />
          <KpiTile
            label="Elements changed"
            value={changeTotal(change).toLocaleString()}
            tone={changeTotal(change) > 0 ? "warning" : "neutral"}
            hint={
              change
                ? `+${change.addedCount} · ~${change.modifiedCount} · −${change.removedCount}`
                : "baseline revision"
            }
          />
        </div>

        {/* ------------------------------------------- viewer + timeline */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <Card
            title={model ? (model.displayName ?? model.name) : "Model"}
            subtitle={
              revision
                ? `${revision.message ?? "(no commit message)"} · ${formatDateTime(revision.createdAt)}`
                : undefined
            }
            actions={
              <>
                <Button
                  variant="ghost"
                  onClick={() => step(1)}
                  disabled={index < 0 || index >= revisions.length - 1}
                  title="Older revision (←)"
                >
                  ← older
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => step(-1)}
                  disabled={index <= 0}
                  title="Newer revision (→)"
                >
                  newer →
                </Button>
              </>
            }
          >
            <Viewer
              serverUrl={serverUrl}
              projectId={state.projectId}
              modelId={activeModelId ?? ""}
              versionId={activeVersionId}
              referencedObject={revision?.referencedObject ?? null}
              highlight={highlight}
              mode={effectiveMode}
              modeCounts={{
                ALL: null,
                ADDED: change?.addedCount ?? 0,
                MODIFIED: change?.modifiedCount ?? 0,
                REMOVED: change?.removedCount ?? 0,
              }}
              onModeChange={setMode}
              changes={state.changes}
              revisionCount={revisions.length}
            />
            {effectiveMode === "REMOVED" && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Removed elements are not in this revision. They are loaded
                individually by object id — Speckle objects are content-addressed,
                so they stay reachable after the revision that dropped them.
              </p>
            )}
          </Card>

          <Card
            title="Revisions"
            subtitle="Newest first — click one, or use ← and →"
            className="max-h-[720px] overflow-y-auto"
          >
            <RevisionRail
              revisions={revisions}
              changes={state.changes}
              selectedVersionId={activeVersionId}
              onSelect={(next) => {
                setVersionId(next);
                setMode("ALL");
              }}
            />
          </Card>
        </div>

        {/* --------------------------------------------- masses / changes */}
        <Card
          title={
            <span className="flex items-center gap-1">
              {(
                [
                  ["MASSES", "Masses"],
                  ["CHANGES", "What changed"],
                  ["TRENDS", "By revision"],
                  ["ANALYTICS", "Over time"],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-md px-2 py-1 text-sm font-semibold transition-colors ${
                    tab === key
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {label}
                  {key === "CHANGES" && changeTotal(change) > 0 && (
                    <span className="ml-1.5 font-mono text-[10px] opacity-70">
                      {changeTotal(change)}
                    </span>
                  )}
                </button>
              ))}
            </span>
          }
          subtitle={
            tab === "MASSES"
              ? "Read off the model's own properties — nothing retyped"
              : tab === "CHANGES"
                ? "Element-level diff against the previous revision"
                : tab === "TRENDS"
                  ? `${revisions.length} revisions of history, held in this document`
                  : "Read over GraphQL from the analytics read models in switchboard"
          }
          actions={
            tab === "MASSES" ? (
              <>
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Toggle
                    checked={showDeltas}
                    onChange={setShowDeltas}
                    label="Show change against the previous revision"
                    disabled={!change}
                  />
                  deltas
                </span>
                <Button onClick={exportMasses} disabled={rows.length === 0}>
                  Export CSV
                </Button>
              </>
            ) : tab === "TRENDS" ? (
              <span className="flex items-center gap-1">
                {MEASURES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMeasure(option)}
                    className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                      measure === option
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                        : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {MEASURE_LABELS[option]}
                  </button>
                ))}
              </span>
            ) : undefined
          }
        >
          {tab === "MASSES" ? (
            <MassTable
              rows={rows}
              vanished={vanished}
              showDeltas={showDeltas && change != null}
            />
          ) : tab === "CHANGES" ? (
            <ChangePanel
              change={change}
              revision={revision}
              previous={previous}
              mode={effectiveMode}
              onModeChange={setMode}
            />
          ) : tab === "ANALYTICS" ? (
            <AnalyticsPanel
              projectId={state.projectId}
              projectDocumentId={document.header.id}
              from={analyticsWindow.from}
              to={analyticsWindow.to}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {MEASURE_LABELS[measure]} per category
                </h4>
                <LineChart
                  series={trendToStacked(series)}
                  label={MEASURE_LABELS[measure]}
                  selectedPeriod={
                    activeVersionId ? shortHash(activeVersionId) : null
                  }
                  onSelect={(label) => {
                    const match = revisions.find(
                      (revision) => shortHash(revision.versionId) === label,
                    );

                    if (match) {
                      setVersionId(match.versionId);
                      setMode("ALL");
                    }
                  }}
                />
              </section>

              <section className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Elements changed per revision
                </h4>
                <StackedBarChart
                  series={churnToStacked(churn)}
                  label="Elements changed"
                  // The same colours the 3D view paints with, so a tall amber
                  // bar and the amber elements in the model read as one fact.
                  colours={{
                    added: CHANGE_COLOURS.ADDED,
                    modified: CHANGE_COLOURS.MODIFIED,
                    removed: CHANGE_COLOURS.REMOVED,
                  }}
                  selectedPeriod={
                    activeVersionId ? shortHash(activeVersionId) : null
                  }
                  onSelect={(label) => {
                    const match = revisions.find(
                      (revision) => shortHash(revision.versionId) === label,
                    );

                    if (match) {
                      setVersionId(match.versionId);
                      setMode("ALL");
                    }
                  }}
                />
              </section>

              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Click any revision in either chart to move the whole view onto
                it. Both are read straight from this document — no processor, no
                warehouse.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
