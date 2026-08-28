import { formatDateTime, formatRelative, shortHash } from "../../shared/format.js";
import { Cell, EmptyState, Row, Table } from "../../shared/ui.js";
import type { FeedEntry } from "../logic.js";

/**
 * Every change on the drive in one list.
 *
 * This is what the drive is for: seeing that a model moved, in which project,
 * and by how much, without opening anything.
 */
export function ChangeFeed({
  entries,
  onOpen,
}: {
  entries: FeedEntry[];
  onOpen: (documentId: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No model changes recorded yet"
        hint="Once a sync has mirrored two revisions of a model, what moved between them shows up here."
      />
    );
  }

  return (
    <Table
      headers={[
        "When",
        "Project",
        "Model",
        "Revision",
        { label: "Added", align: "right" },
        { label: "Modified", align: "right" },
        { label: "Removed", align: "right" },
      ]}
    >
      {entries.map((entry) => (
        <Row key={entry.key} onClick={() => onOpen(entry.documentId)}>
          <Cell title={formatDateTime(entry.change.detectedAt)}>
            {formatRelative(entry.change.detectedAt)}
          </Cell>
          <Cell className="font-medium text-slate-900 dark:text-slate-100">
            {entry.projectName}
          </Cell>
          <Cell>{entry.modelName}</Cell>
          <Cell mono title={`${entry.change.fromVersionId ?? "∅"} → ${entry.change.toVersionId}`}>
            {shortHash(entry.change.fromVersionId) || "∅"} →{" "}
            {shortHash(entry.change.toVersionId)}
          </Cell>
          <Cell align="right" mono>
            {entry.change.addedCount > 0 ? (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                +{entry.change.addedCount}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">—</span>
            )}
          </Cell>
          <Cell align="right" mono>
            {entry.change.modifiedCount > 0 ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                ~{entry.change.modifiedCount}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">—</span>
            )}
          </Cell>
          <Cell align="right" mono>
            {entry.change.removedCount > 0 ? (
              <span className="font-semibold text-red-600 dark:text-red-400">
                −{entry.change.removedCount}
              </span>
            ) : (
              <span className="text-slate-300 dark:text-slate-600">—</span>
            )}
          </Cell>
        </Row>
      ))}
    </Table>
  );
}
