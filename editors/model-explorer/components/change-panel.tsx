import type { ChangeEntry, Revision } from "document-models/speckle-project";
import { formatQuantity, formatRelative, shortHash } from "../../shared/format.js";
import { Cell, Chip, EmptyState, Row, Table } from "../../shared/ui.js";
import { shortType } from "../logic.js";
import type { IsolationMode } from "../logic.js";

function Count({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={value === 0}
      onClick={onClick}
      title={
        value === 0
          ? `Nothing ${label.toLowerCase()}`
          : `Isolate the ${value} ${label.toLowerCase()} object(s) in the 3D view`
      }
      className={`flex-1 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tone} ${
        active ? "ring-2 ring-sky-400" : ""
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </div>
    </button>
  );
}

/**
 * What the sync found had changed between two revisions, at element level.
 *
 * Element identity comes from the authoring tool's own id, so an edited wall
 * shows up as modified rather than as one deletion plus one addition — which is
 * what a naive content-hash diff would report.
 */
export function ChangePanel({
  change,
  revision,
  previous,
  mode,
  onModeChange,
}: {
  change: ChangeEntry | null;
  revision: Revision | null;
  previous: Revision | null;
  mode: IsolationMode;
  onModeChange: (next: IsolationMode) => void;
}) {
  if (!change) {
    return (
      <EmptyState
        title={
          previous
            ? "No change recorded for this revision"
            : "This is the baseline revision"
        }
        hint={
          previous
            ? "The sync records a change entry for every revision it mirrors after the first one."
            : "There is nothing before it to compare against. Pick a later revision to see what moved."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <Chip mono title={`From version ${change.fromVersionId ?? "—"}`}>
          {shortHash(change.fromVersionId) || "∅"}
        </Chip>
        <span>→</span>
        <Chip mono title={`To version ${change.toVersionId}`}>
          {shortHash(change.toVersionId)}
        </Chip>
        <span className="ml-auto">
          detected {formatRelative(change.detectedAt)}
        </span>
      </div>

      <div className="flex gap-2">
        <Count
          label="Added"
          value={change.addedCount}
          tone="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          active={mode === "ADDED"}
          onClick={() => onModeChange("ADDED")}
        />
        <Count
          label="Modified"
          value={change.modifiedCount}
          tone="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          active={mode === "MODIFIED"}
          onClick={() => onModeChange("MODIFIED")}
        />
        <Count
          label="Removed"
          value={change.removedCount}
          tone="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          active={mode === "REMOVED"}
          onClick={() => onModeChange("REMOVED")}
        />
      </div>

      {revision?.truncated && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          This revision hit the sync's object cap, so the diff covers only the
          objects that were walked.
        </p>
      )}

      {change.deltas.length === 0 ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          No category totals moved — the change is in properties rather than in
          quantities.
        </p>
      ) : (
        <Table
          headers={[
            "Category",
            { label: "Count", align: "right" },
            { label: "Volume", align: "right" },
            { label: "Area", align: "right" },
          ]}
        >
          {change.deltas.map((delta) => (
            <Row key={delta.speckleType}>
              <Cell
                title={delta.speckleType}
                className="font-medium text-slate-900 dark:text-slate-100"
              >
                {shortType(delta.speckleType)}
                {delta.unit && (
                  <span className="ml-1 text-[10px] text-slate-400">
                    {delta.unit}
                  </span>
                )}
              </Cell>
              <Cell align="right" mono>
                {delta.countBefore.toLocaleString()} →{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  {delta.countAfter.toLocaleString()}
                </strong>
              </Cell>
              <Cell align="right" mono>
                {formatQuantity(delta.volumeBefore)} →{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  {formatQuantity(delta.volumeAfter)}
                </strong>
              </Cell>
              <Cell align="right" mono>
                {formatQuantity(delta.areaBefore)} →{" "}
                <strong className="text-slate-900 dark:text-slate-100">
                  {formatQuantity(delta.areaAfter)}
                </strong>
              </Cell>
            </Row>
          ))}
        </Table>
      )}
    </div>
  );
}
