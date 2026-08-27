import { useEffect, useState } from "react";
import { buildVersionUrl } from "../../shared/speckle.js";
import { Button, EmptyState } from "../../shared/ui.js";
import type { ChangeEntry } from "document-models/speckle-project";
import type { IsolationMode } from "../logic.js";
import { ElementPanel } from "./element-panel.js";
import { CHANGE_COLOURS, LiveViewer, type Highlight } from "./live-viewer.js";

const MODE_LABELS: Record<IsolationMode, string> = {
  ALL: "Whole model",
  ADDED: "Added",
  MODIFIED: "Modified",
  REMOVED: "Removed",
};

const MODE_TONES: Record<IsolationMode, string> = {
  ALL: "border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  ADDED:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  MODIFIED:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  REMOVED:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200",
};

function Swatch({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-black/10"
        style={{ backgroundColor: colour }}
      />
      {label}
    </span>
  );
}

/**
 * The 3D view.
 *
 * The viewer runs here rather than in Speckle's iframe, because painting
 * elements by what happened to them needs the viewer's own API — the hosted
 * embed is configurable only through its URL, and that URL carries no colouring.
 */
export function Viewer({
  serverUrl,
  projectId,
  modelId,
  versionId,
  referencedObject,
  highlight,
  mode,
  modeCounts,
  onModeChange,
  token,
  changes,
  revisionCount,
}: {
  serverUrl: string;
  projectId: string;
  modelId: string;
  versionId: string | null;
  referencedObject: string | null;
  highlight: Highlight;
  mode: IsolationMode;
  modeCounts: Record<IsolationMode, number | null>;
  onModeChange: (next: IsolationMode) => void;
  token?: string | null;
  changes: ChangeEntry[];
  revisionCount: number;
}) {
  // Remounts the viewer, which is the honest way to recover from a bad load.
  const [nonce, setNonce] = useState(0);
  const [picked, setPicked] = useState<Record<string, unknown> | null>(null);

  // A different revision is a different scene, so a stale selection would be
  // describing an element that is no longer on screen.
  useEffect(() => setPicked(null), [referencedObject]);

  if (!versionId || !referencedObject) {
    return (
      <EmptyState
        title="No revision selected"
        hint="Run a sync to mirror this project's revisions, then pick one from the timeline."
      />
    );
  }

  const focused =
    mode === "ADDED"
      ? highlight.added
      : mode === "MODIFIED"
        ? highlight.modified
        : mode === "REMOVED"
          ? highlight.removed
          : [];

  // With a category picked, the full-tab link opens exactly those objects in
  // Speckle; otherwise it opens the revision.
  const viewerUrl = buildVersionUrl(
    serverUrl,
    projectId,
    modelId,
    versionId,
    focused,
  );
  const anyChange =
    highlight.added.length + highlight.modified.length + highlight.removed.length >
    0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(MODE_LABELS) as IsolationMode[]).map((option) => {
          const count = modeCounts[option];
          const unavailable = option !== "ALL" && !count;

          return (
            <button
              key={option}
              type="button"
              disabled={unavailable}
              onClick={() => onModeChange(option)}
              title={
                unavailable
                  ? `Nothing was ${MODE_LABELS[option].toLowerCase()} in this revision`
                  : option === "ALL"
                    ? "Show the whole model, with changes coloured"
                    : `Bring the ${MODE_LABELS[option].toLowerCase()} elements forward and ghost the rest`
              }
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === option
                  ? MODE_TONES[option] + " ring-2 ring-sky-400"
                  : MODE_TONES[option]
              }`}
            >
              {MODE_LABELS[option]}
              {count != null && option !== "ALL" && (
                <span className="font-mono tabular-nums opacity-70">
                  {count}
                </span>
              )}
            </button>
          );
        })}

        <span className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            onClick={() => setNonce((value) => value + 1)}
            title="Reload the model"
          >
            ↻
          </Button>
          <a
            href={viewerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title={
              focused.length > 0
                ? `Open these ${focused.length} objects in Speckle`
                : "Open this revision in Speckle"
            }
          >
            Open in Speckle ↗
          </a>
        </span>
      </div>

      <LiveViewer
        key={`${referencedObject}#${nonce}`}
        serverUrl={serverUrl}
        projectId={projectId}
        referencedObject={referencedObject}
        highlight={highlight}
        mode={mode}
        token={token}
        onPick={setPicked}
        overlay={
          picked && (
            <ElementPanel
              raw={picked}
              changes={changes}
              revisionCount={revisionCount}
              onClose={() => setPicked(null)}
            />
          )
        }
      />

      {!picked && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Click an element in the model to see its properties and what every
          revision did to it.
        </p>
      )}

      {anyChange && (
        <div className="flex flex-wrap items-center gap-3">
          <Swatch colour={CHANGE_COLOURS.ADDED} label="added" />
          <Swatch colour={CHANGE_COLOURS.MODIFIED} label="modified" />
          <Swatch colour={CHANGE_COLOURS.REMOVED} label="removed" />
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            everything else is the model as it stands
          </span>
        </div>
      )}
    </div>
  );
}
