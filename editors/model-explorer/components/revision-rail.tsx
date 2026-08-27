import { formatDateTime, formatRelative, shortHash } from "../../shared/format.js";
import { Chip, EmptyState } from "../../shared/ui.js";
import type { Revision } from "document-models/speckle-project";
import type { ChangeEntry } from "document-models/speckle-project";

/**
 * The revision timeline.
 *
 * Newest at the top, one row per mirrored revision, each showing what the sync
 * found had changed. Clicking a row moves the whole editor — viewer, masses and
 * change panel — onto that revision.
 */
export function RevisionRail({
  revisions,
  changes,
  selectedVersionId,
  onSelect,
}: {
  revisions: Revision[];
  changes: ChangeEntry[];
  selectedVersionId: string | null;
  onSelect: (versionId: string) => void;
}) {
  if (revisions.length === 0) {
    return (
      <EmptyState
        title="No revisions mirrored yet"
        hint="The sync document pulls this model's version history into the document."
      />
    );
  }

  return (
    <ol className="flex flex-col">
      {revisions.map((revision, index) => {
        const change = changes.find(
          (entry) => entry.toVersionId === revision.versionId,
        );
        const selected = revision.versionId === selectedVersionId;
        const isLatest = index === 0;

        return (
          <li key={revision.versionId} className="relative pl-6">
            {/* The spine, stopping at the last row. */}
            {index < revisions.length - 1 && (
              <span className="absolute left-[7px] top-6 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
            )}
            <span
              className={`absolute left-0 top-4 h-3.5 w-3.5 rounded-full border-2 ${
                selected
                  ? "border-sky-500 bg-sky-500"
                  : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
              }`}
            />

            <button
              type="button"
              onClick={() => onSelect(revision.versionId)}
              aria-current={selected ? "true" : undefined}
              className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                selected
                  ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950"
                  : "border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {revision.message ?? "(no commit message)"}
                </span>
                {isLatest && (
                  <span className="shrink-0 rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white dark:bg-slate-100 dark:text-slate-900">
                    latest
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span title={formatDateTime(revision.createdAt)}>
                  {formatRelative(revision.createdAt)}
                </span>
                {revision.authorName && <span>· {revision.authorName}</span>}
                {revision.sourceApplication && (
                  <span>· {revision.sourceApplication}</span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <Chip mono title={`Version ${revision.versionId}`}>
                  {shortHash(revision.versionId)}
                </Chip>
                <Chip title={`${revision.objectCount} objects walked`}>
                  {revision.objectCount.toLocaleString()} obj
                </Chip>
                {revision.truncated && (
                  <span
                    title="The sync stopped at its object cap, so these totals are partial"
                    className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  >
                    partial
                  </span>
                )}

                {change ? (
                  <span className="ml-auto flex items-center gap-1 font-mono text-[10px] tabular-nums">
                    {change.addedCount > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{change.addedCount}
                      </span>
                    )}
                    {change.modifiedCount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        ~{change.modifiedCount}
                      </span>
                    )}
                    {change.removedCount > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        −{change.removedCount}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">
                    baseline
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
