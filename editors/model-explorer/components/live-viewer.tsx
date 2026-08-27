import {
  CameraController,
  DefaultViewerParams,
  ViewerEvent,
  FilteringExtension,
  MeasurementsExtension,
  SectionOutlines,
  SectionTool,
  SelectionExtension,
  SpeckleLoader,
  Viewer,
} from "@speckle/viewer";
import { useEffect, useRef, useState } from "react";
import type { IsolationMode } from "../logic.js";

/**
 * How each kind of change is painted. Kept as CSS colours because the viewer
 * parses them with three.js `Color`.
 */
export const CHANGE_COLOURS = {
  ADDED: "#10b981",
  MODIFIED: "#f59e0b",
  REMOVED: "#ef4444",
} as const;

/** Deleted elements are loaded one object at a time, so this is a real cost. */
const MAX_REMOVED_LOADS = 25;

export interface Highlight {
  added: string[];
  modified: string[];
  removed: string[];
}

interface LoadState {
  status: "IDLE" | "LOADING" | "READY" | "FAILED";
  message: string | null;
  /** Removed elements actually pulled into the scene. */
  removedLoaded: number;
}

/** `/streams/:projectId/objects/:objectId` — the only shape the loader accepts. */
function objectResource(
  serverUrl: string,
  projectId: string,
  objectId: string,
): string {
  return `${serverUrl.replace(/\/+$/, "")}/streams/${projectId}/objects/${objectId}`;
}

interface PickedNode {
  model?: { raw?: Record<string, unknown> };
  parent?: PickedNode | null;
}

/**
 * The element behind a click.
 *
 * A hit usually lands on the display mesh, which carries geometry and nothing
 * else, so this walks up to the nearest ancestor that has an `applicationId` —
 * the element the authoring tool actually named.
 */
function elementOf(hit: unknown): Record<string, unknown> | null {
  let node = hit as PickedNode | null | undefined;
  let fallback: Record<string, unknown> | null = null;

  for (let depth = 0; node && depth < 12; depth++) {
    const raw = node.model?.raw;

    if (raw) {
      fallback = fallback ?? raw;

      if (typeof raw.applicationId === "string" && raw.applicationId.length > 0) {
        return raw;
      }
    }

    node = node.parent;
  }

  return fallback;
}

/**
 * The Speckle viewer, running in this editor rather than in an iframe.
 *
 * The hosted Speckle embed can only be configured through its URL, and that URL
 * carries no colouring or filtering — so painting added, modified and removed
 * elements means driving the viewer directly.
 *
 * Deleted elements are not in the selected revision, so they are loaded
 * individually by object id: Speckle objects are content-addressed and stay
 * reachable after the revision that dropped them.
 */
export function LiveViewer({
  serverUrl,
  projectId,
  referencedObject,
  highlight,
  mode,
  token,
  onPick,
  overlay,
}: {
  serverUrl: string;
  projectId: string;
  referencedObject: string | null;
  highlight: Highlight;
  mode: IsolationMode;
  token?: string | null;
  /** The clicked element's raw Speckle object, or null when nothing is hit. */
  onPick?: (raw: Record<string, unknown> | null) => void;
  /** Rendered over the canvas, for a details panel. */
  overlay?: React.ReactNode;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const viewer = useRef<Viewer | null>(null);
  const [load, setLoad] = useState<LoadState>({
    status: "IDLE",
    message: null,
    removedLoaded: 0,
  });

  // Colours are re-applied whenever the scene finishes loading, so the effect
  // below reads them from a ref rather than re-running on every change.
  const latest = useRef({ highlight, mode, onPick });
  latest.current = { highlight, mode, onPick };

  /* --------------------------------------------------- create and load */
  useEffect(() => {
    const element = container.current;
    if (!element || !referencedObject) return;

    const abort = new AbortController();
    // Read through a call so the guards survive: flow analysis narrows a plain
    // flag to false, never seeing the cleanup below abort it mid-await.
    const cancelled = () => abort.signal.aborted;

    // Held in an object assigned synchronously, so cleanup can always dispose
    // the instance even if it aborts while `init` is still running. Without
    // this, a remount leaves the first viewer alive with its canvas in the DOM.
    const held: { instance: Viewer | null } = { instance: null };

    async function boot() {
      setLoad({ status: "LOADING", message: null, removedLoaded: 0 });

      try {
        const instance = new Viewer(element!, {
          ...DefaultViewerParams,
          showStats: false,
          verbose: false,
        });

        held.instance = instance;

        await instance.init();

        if (cancelled()) return;

        // The container gets its height from an aspect ratio, so it can still be
        // zero when the viewer initialises. Without this the renderer is sized
        // 0x0 and draws nothing.
        instance.resize();

        // The camera controller has to exist before selection, which injects it.
        instance.createExtension(CameraController);
        instance.createExtension(SelectionExtension);
        instance.createExtension(FilteringExtension);
        // Section and measurement come from Speckle's own viewer; registering
        // them keeps this view as capable as the hosted embed it replaces.
        instance.createExtension(SectionTool);
        instance.createExtension(SectionOutlines);
        instance.createExtension(MeasurementsExtension);

        // A click reports the element, not its display mesh: in a real model the
        // geometry hangs below the element that carries the properties.
        instance.on(ViewerEvent.ObjectClicked, (event) => {
          const hit = event?.hits[0]?.node;

          latest.current.onPick?.(hit ? elementOf(hit) : null);
        });

        // Published only past the cancellation check, so the colouring effect
        // can never reach a viewer this effect has already abandoned.
        viewer.current = instance;

        await instance.loadObject(
          new SpeckleLoader(
            instance.getWorldTree(),
            objectResource(serverUrl, projectId, referencedObject!),
            token ?? undefined,
          ),
          true,
        );

        if (cancelled()) return;

        // Deleted elements, so they can be shown in red alongside what remains.
        const removed = latest.current.highlight.removed.slice(
          0,
          MAX_REMOVED_LOADS,
        );
        let removedLoaded = 0;

        for (const objectId of removed) {
          if (cancelled()) return;

          try {
            await instance.loadObject(
              new SpeckleLoader(
                instance.getWorldTree(),
                objectResource(serverUrl, projectId, objectId),
                token ?? undefined,
              ),
              false,
            );
            removedLoaded += 1;
          } catch {
            // A deleted object may have been garbage collected server-side;
            // the rest of the scene is still worth showing.
          }
        }

        if (cancelled()) return;

        instance.resize();
        setLoad({ status: "READY", message: null, removedLoaded });
      } catch (error) {
        if (cancelled()) return;

        setLoad({
          status: "FAILED",
          message: error instanceof Error ? error.message : String(error),
          removedLoaded: 0,
        });
      }
    }

    void boot();

    const observer = new ResizeObserver(() => held.instance?.resize());
    observer.observe(element);

    return () => {
      abort.abort();
      observer.disconnect();

      // Only stand down if the shared ref is still ours; a remount may already
      // have published its own viewer.
      if (viewer.current === held.instance) viewer.current = null;

      try {
        held.instance?.dispose();
      } catch {
        // Disposing a viewer that never finished initialising throws; nothing
        // useful to do about it on unmount.
      }

      // Speckle leaves its canvas in the DOM after dispose, and this container
      // holds nothing else, so clear it rather than stack a dead canvas under
      // the next one.
      element.replaceChildren();
    };
  }, [serverUrl, projectId, referencedObject, token]);

  /* ------------------------------------------------- paint and isolate */
  useEffect(() => {
    const instance = viewer.current;
    if (!instance || load.status !== "READY") return;

    const filtering = instance.getExtension(FilteringExtension);

    filtering.resetFilters();

    if (mode !== "ALL") {
      const ids =
        mode === "ADDED"
          ? highlight.added
          : mode === "MODIFIED"
            ? highlight.modified
            : highlight.removed;

      // Defaults include descendants and ghost everything else, which keeps the
      // rest of the model as context instead of hiding it.
      if (ids.length > 0) filtering.isolateObjects(ids, "change-isolation");
    }

    const groups = [
      { objectIds: highlight.added, color: CHANGE_COLOURS.ADDED },
      { objectIds: highlight.modified, color: CHANGE_COLOURS.MODIFIED },
      { objectIds: highlight.removed, color: CHANGE_COLOURS.REMOVED },
    ].filter((group) => group.objectIds.length > 0);

    if (groups.length > 0) filtering.setUserObjectColors(groups);

    instance.requestRender();
  }, [highlight, mode, load.status]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
      <div ref={container} className="h-full w-full" />

      {overlay && (
        <div className="pointer-events-none absolute bottom-3 right-3 top-3 flex items-start justify-end">
          {overlay}
        </div>
      )}

      {load.status === "LOADING" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-800/80">
          <p className="animate-pulse text-xs font-medium text-slate-500 dark:text-slate-400">
            Loading the model from Speckle…
          </p>
        </div>
      )}

      {load.status === "FAILED" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p className="max-w-md text-center text-xs text-red-700 dark:text-red-300">
            <strong>The viewer could not load this revision.</strong>{" "}
            {load.message}
          </p>
        </div>
      )}

      {load.status === "READY" &&
        highlight.removed.length > load.removedLoaded && (
          <div className="absolute inset-x-0 bottom-0 bg-amber-50/95 px-3 py-1.5 text-[11px] text-amber-900 dark:bg-amber-950/95 dark:text-amber-200">
            Showing {load.removedLoaded} of {highlight.removed.length} removed
            elements — each one is a separate load, so the rest are left out.
          </div>
        )}
    </div>
  );
}
