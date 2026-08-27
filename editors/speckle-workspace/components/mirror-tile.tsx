import { formatDateTime, formatRelative } from "../../shared/format.js";
import { Chip } from "../../shared/ui.js";
import type { MirrorCard, SyncDoc } from "../logic.js";

/**
 * One mirrored Speckle project.
 *
 * The thumbnail is Speckle's own preview of the newest revision, so the card
 * shows the actual model rather than a generic file icon.
 */
export function MirrorTile({
  card,
  sync,
  onOpen,
  onOpenSync,
}: {
  card: MirrorCard;
  sync: SyncDoc | null;
  onOpen: () => void;
  onOpenSync: () => void;
}) {
  const stale = card.syncedAt == null;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <button
        type="button"
        onClick={onOpen}
        className="group relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
        title="Open the model explorer"
      >
        {card.previewUrl ? (
          <img
            src={card.previewUrl}
            alt={`Preview of ${card.projectName}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-slate-400 dark:text-slate-500">
            {stale ? "not synced yet" : "no preview"}
          </span>
        )}

        {card.lastChangeSize > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            {card.lastChangeSize} changed
          </span>
        )}
        {card.partial && (
          <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            partial
          </span>
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <h3 className="truncate text-sm font-semibold">{card.projectName}</h3>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {card.latestRevision?.message ?? "no revisions mirrored"}
          </p>
        </button>

        <div className="flex flex-wrap items-center gap-1">
          <Chip title="Models mirrored">{card.modelCount} models</Chip>
          <Chip title="Revisions mirrored">{card.revisionCount} rev</Chip>
          <Chip title="Objects in the newest revision">
            {card.objectCount.toLocaleString()} obj
          </Chip>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800">
          <span
            className={
              stale
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-500 dark:text-slate-400"
            }
            title={formatDateTime(card.syncedAt)}
          >
            {stale ? "never synced" : `synced ${formatRelative(card.syncedAt)}`}
          </span>

          {sync ? (
            <button
              type="button"
              onClick={onOpenSync}
              className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
              title="Open the sync console writing into this mirror"
            >
              {sync.state.status === "IDLE"
                ? "sync ↗"
                : `${sync.state.status.toLowerCase()} ↗`}
            </button>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">no sync</span>
          )}
        </div>
      </div>
    </div>
  );
}
