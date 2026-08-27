import { formatDateTime, formatRelative, shortHash } from "../../shared/format.js";
import { Button, Chip } from "../../shared/ui.js";
import {
  elementHistory,
  readElement,
  shortType,
  type ElementTouch,
} from "../logic.js";
import type { ChangeEntry } from "document-models/speckle-project";
import { CHANGE_COLOURS } from "./live-viewer.js";

// Partial, because the kind arrives as a string from the document and an
// unrecognised one must still render rather than throw.
const KIND_LABELS: Partial<Record<string, string>> = {
  ADDED: "added",
  MODIFIED: "modified",
  REMOVED: "removed",
};

const KIND_COLOURS: Partial<Record<string, string>> = {
  ADDED: CHANGE_COLOURS.ADDED,
  MODIFIED: CHANGE_COLOURS.MODIFIED,
  REMOVED: CHANGE_COLOURS.REMOVED,
};

function KindDot({ kind }: { kind: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: KIND_COLOURS[kind] ?? "#94a3b8" }}
    />
  );
}

function History({ touches }: { touches: ElementTouch[] }) {
  if (touches.length === 0) {
    return (
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Unchanged in every revision mirrored here.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-1">
      {touches.map((touch) => (
        <li
          key={`${touch.versionId}-${touch.kind}`}
          className="flex items-center gap-2 text-[11px]"
        >
          <KindDot kind={touch.kind} />
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {KIND_LABELS[touch.kind] ?? touch.kind.toLowerCase()}
          </span>
          <Chip mono title={`Revision ${touch.versionId}`}>
            {shortHash(touch.versionId)}
          </Chip>
          <span
            className="ml-auto text-slate-500 dark:text-slate-400"
            title={formatDateTime(touch.detectedAt)}
          >
            {formatRelative(touch.detectedAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * What one element is, and what has happened to it.
 *
 * The first half is Speckle's: the properties the authoring tool wrote. The
 * second half is the document's, and it is the half a viewer cannot produce —
 * every revision that touched this element, read from the mirrored diff.
 */
export function ElementPanel({
  raw,
  changes,
  revisionCount,
  onClose,
}: {
  raw: Record<string, unknown> | null;
  changes: ChangeEntry[];
  revisionCount: number;
  onClose: () => void;
}) {
  const element = readElement(raw);
  const touches = elementHistory(changes, element.identity, element.objectId);

  const revisionsTouched = new Set(touches.map((touch) => touch.versionId)).size;

  return (
    <aside className="pointer-events-auto flex max-h-full w-72 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {element.speckleType ? shortType(element.speckleType) : "Element"}
          </h4>
          <p
            className="mt-0.5 truncate font-mono text-[10px] text-slate-500 dark:text-slate-400"
            title={element.identity ?? element.objectId ?? ""}
          >
            {element.identity ?? shortHash(element.objectId)}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose} title="Close">
          ✕
        </Button>
      </header>

      <div className="flex flex-col gap-3 overflow-y-auto px-3 py-2.5">
        {element.quantities.length > 0 && (
          <section className="flex flex-col gap-1">
            {element.quantities.map((quantity) => (
              <div
                key={quantity.key}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {quantity.label}
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100">
                  {quantity.value.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                  {quantity.unit && (
                    <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">
                      {quantity.unit}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </section>
        )}

        {element.attributes.length > 0 && (
          <section className="flex flex-col gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
            {element.attributes.map((attribute) => (
              <div
                key={attribute.label}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                  {attribute.label}
                </span>
                <span
                  className="truncate text-right text-[11px] text-slate-700 dark:text-slate-200"
                  title={attribute.value}
                >
                  {attribute.value}
                </span>
              </div>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
          <div className="flex items-baseline justify-between gap-2">
            <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              History
            </h5>
            {touches.length > 0 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                touched in {revisionsTouched} of {revisionCount}
              </span>
            )}
          </div>
          <History touches={touches} />
        </section>

        {element.quantities.length === 0 &&
          element.attributes.length === 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              This object carries no properties beyond its geometry — the
              authoring tool wrote none.
            </p>
          )}
      </div>
    </aside>
  );
}
