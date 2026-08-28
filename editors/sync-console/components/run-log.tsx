import type { SyncRun } from "document-models/speckle-sync";
import {
  formatDateTime,
  formatRelative,
} from "../../shared/format.js";
import { Cell, EmptyState, Row, StatusPill, Table } from "../../shared/ui.js";

function duration(run: SyncRun): string {
  if (!run.startedAt || !run.finishedAt) return "—";

  const ms =
    new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();

  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;

  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Every sync attempt, newest first.
 *
 * The runs live in the document rather than in a log file, so the history of
 * how the mirror came to look the way it does travels with it.
 */
export function RunLog({ runs }: { runs: SyncRun[] }) {
  if (runs.length === 0) {
    return (
      <EmptyState
        title="No syncs yet"
        hint="Run one to pull this project's models, revisions and quantities into the mirror document."
      />
    );
  }

  return (
    <Table
      headers={[
        "Requested",
        "Outcome",
        { label: "Models", align: "right" },
        { label: "Versions", align: "right" },
        { label: "New", align: "right" },
        { label: "Objects", align: "right" },
        { label: "Took", align: "right" },
        "Mode",
        "Detail",
      ]}
    >
      {runs.map((run) => (
        <Row key={run.id}>
          <Cell title={formatDateTime(run.requestedAt)}>
            {formatRelative(run.requestedAt)}
          </Cell>
          <Cell>
            <StatusPill status={run.outcome} />
          </Cell>
          <Cell align="right" mono>
            {run.modelsSeen.toLocaleString()}
          </Cell>
          <Cell align="right" mono>
            {run.versionsSeen.toLocaleString()}
          </Cell>
          <Cell align="right" mono>
            {run.versionsAdded > 0 ? (
              <strong className="text-emerald-600 dark:text-emerald-400">
                +{run.versionsAdded}
              </strong>
            ) : (
              "0"
            )}
          </Cell>
          <Cell align="right" mono>
            {run.objectsScanned.toLocaleString()}
          </Cell>
          <Cell align="right" mono>
            {duration(run)}
          </Cell>
          <Cell className="text-slate-500 dark:text-slate-400">
            {run.fullResync ? "full" : "incremental"}
          </Cell>
          <Cell
            className={
              run.outcome === "FAILURE"
                ? "text-red-600 dark:text-red-400"
                : "text-slate-500 dark:text-slate-400"
            }
          >
            {run.message ?? "—"}
          </Cell>
        </Row>
      ))}
    </Table>
  );
}
