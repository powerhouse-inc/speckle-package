import {
  DefaultEditorLoader,
  DocumentToolbar,
} from "@powerhousedao/design-system/connect/index";
import {
  addDocument,
  isFileNodeKind,
  setSelectedNode,
  useEditorModulesForDocumentType,
  useSelectedDrive,
  useSelectedNode,
} from "@powerhousedao/reactor-browser";
import { useSpeckleProjectDocumentsInSelectedDrive } from "document-models/speckle-project";
import { useSpeckleSyncDocumentsInSelectedDrive } from "document-models/speckle-sync";
import { Suspense, useMemo, useState } from "react";
import { formatRelative } from "../shared/format.js";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  KpiTile,
  StatusPill,
} from "../shared/ui.js";
import { ChangeFeed } from "./components/change-feed.js";
import { PortfolioCharts } from "./components/portfolio-charts.js";
import { MirrorTile } from "./components/mirror-tile.js";
import {
  changeFeed,
  driveTotals,
  mirrorCards,
  syncFor,
  unpairedSyncs,
  type ProjectDoc,
  type SyncDoc,
} from "./logic.js";

/**
 * Hands a selected document to its own editor.
 *
 * A drive app owns the whole drive surface, document routes included, so
 * selecting a file has to be resolved here rather than by Connect.
 */
function SelectedDocumentEditor({
  documentType,
}: {
  documentType: string;
}) {
  const editorModule = useEditorModulesForDocumentType(documentType)?.[0];

  if (!editorModule) {
    return (
      <div className="min-h-full bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <DocumentToolbar />
        <EmptyState
          title={`No editor for ${documentType}`}
          hint="This package registers editors for Speckle sync and Speckle project documents."
        />
      </div>
    );
  }

  const DocumentEditor = editorModule.Component;

  return (
    <Suspense fallback={<DefaultEditorLoader />}>
      <DocumentEditor />
    </Suspense>
  );
}

export default function Editor() {
  const [drive] = useSelectedDrive();
  const selectedNode = useSelectedNode();
  const projectDocuments = useSpeckleProjectDocumentsInSelectedDrive();
  const syncDocuments = useSpeckleSyncDocumentsInSelectedDrive();

  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projects: ProjectDoc[] = useMemo(
    () =>
      (projectDocuments ?? []).map((document) => ({
        documentId: document.header.id,
        documentName: document.header.name,
        state: document.state.global,
      })),
    [projectDocuments],
  );

  const syncs: SyncDoc[] = useMemo(
    () =>
      (syncDocuments ?? []).map((document) => ({
        documentId: document.header.id,
        documentName: document.header.name,
        state: document.state.global,
      })),
    [syncDocuments],
  );

  const cards = useMemo(() => mirrorCards(projects), [projects]);

  const analyticsWindow = useMemo(() => {
    const dates = projects
      .flatMap((doc) => doc.state.revisions)
      .map((revision) => revision.createdAt ?? revision.syncedAt)
      .filter((value): value is string => Boolean(value))
      .sort();

    const pad = (iso: string, months: number) => {
      const at = new Date(iso);
      at.setUTCMonth(at.getUTCMonth() + months);
      return at.toISOString().slice(0, 10);
    };

    const first = dates[0];
    const last = dates[dates.length - 1];

    return first && last
      ? { from: pad(first, -1), to: pad(last, 1) }
      : { from: "2026-01-01", to: "2027-01-01" };
  }, [projects]);
  const feed = useMemo(() => changeFeed(projects), [projects]);
  const totals = driveTotals(projects, syncs);
  const orphans = unpairedSyncs(syncs, projects);

  async function create(documentType: string, name: string) {
    setCreating(documentType);
    setError(null);

    try {
      const node = await addDocument(drive.header.id, name, documentType);
      setSelectedNode(node.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setCreating(null);
    }
  }

  if (selectedNode && isFileNodeKind(selectedNode)) {
    return <SelectedDocumentEditor documentType={selectedNode.documentType} />;
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <DocumentToolbar />

      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4">
        {/* ------------------------------------------------------- header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">
              {drive.state.global.name || "Speckle workspace"}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Speckle projects mirrored into Powerhouse documents — the geometry
              stays in Speckle, the quantities and the change history live here.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={creating != null}
              onClick={() =>
                void create("speckle/project", "Speckle project mirror")
              }
            >
              {creating === "speckle/project" ? "Creating…" : "+ Mirror"}
            </Button>
            <Button
              variant="primary"
              disabled={creating != null}
              onClick={() => void create("speckle/sync", "Speckle sync")}
            >
              {creating === "speckle/sync" ? "Creating…" : "+ Sync"}
            </Button>
          </div>
        </header>

        {error && (
          <Banner tone="error" onDismiss={() => setError(null)}>
            <strong>Could not create the document.</strong> {error}
          </Banner>
        )}

        {totals.syncsFailing > 0 && (
          <Banner tone="error">
            {totals.syncsFailing} sync
            {totals.syncsFailing === 1 ? "" : "s"} failed on the last run — open
            the console below to see why.
          </Banner>
        )}

        {/* ---------------------------------------------------------- KPIs */}
        <div className="flex flex-wrap gap-2">
          <KpiTile label="Projects mirrored" value={totals.mirrors} />
          <KpiTile label="Models" value={totals.models} />
          <KpiTile
            label="Revisions"
            value={totals.revisions.toLocaleString()}
            hint="version history held in documents"
          />
          <KpiTile
            label="Objects"
            value={totals.objects.toLocaleString()}
            hint="in the newest revisions"
          />
          <KpiTile
            label="Elements changed"
            value={totals.elementsChanged.toLocaleString()}
            tone={totals.elementsChanged > 0 ? "warning" : "neutral"}
            hint="across every recorded change"
          />
          <KpiTile
            label="Syncs"
            value={syncs.length}
            tone={totals.syncsFailing > 0 ? "danger" : "neutral"}
            hint={
              totals.syncsRunning > 0
                ? `${totals.syncsRunning} running`
                : `${totals.syncsFailing} failing`
            }
          />
        </div>

        {/* ------------------------------------------------------ mirrors */}
        {cards.length === 0 ? (
          <EmptyState
            title="No Speckle project mirrored on this drive yet"
            hint="Create a mirror document and a sync, point the sync at a Speckle project, and run it. The models, revisions, quantities and change history land in the mirror."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <MirrorTile
                key={card.documentId}
                card={card}
                sync={syncFor(syncs, card.documentId)}
                onOpen={() => setSelectedNode(card.documentId)}
                onOpenSync={() => {
                  const sync = syncFor(syncs, card.documentId);
                  if (sync) setSelectedNode(sync.documentId);
                }}
              />
            ))}
          </div>
        )}

        {/* ---------------------------------------------------- portfolio */}
        {cards.length > 0 && (
          <Card
            title="Across the portfolio"
            subtitle="Read over GraphQL from the analytics read models in switchboard"
          >
            <PortfolioCharts
              from={analyticsWindow.from}
              to={analyticsWindow.to}
            />
          </Card>
        )}

        {/* --------------------------------------------------------- feed */}
        <Card
          title="What changed in the models"
          subtitle="Across every mirror on this drive, newest first"
        >
          <ChangeFeed entries={feed} onOpen={setSelectedNode} />
        </Card>

        {/* ------------------------------------------------- loose syncs */}
        {orphans.length > 0 && (
          <Card
            title="Syncs without a mirror"
            subtitle="These will not write anywhere until they are pointed at a mirror document"
          >
            <div className="flex flex-col gap-1.5">
              {orphans.map((sync) => (
                <button
                  key={sync.documentId}
                  type="button"
                  onClick={() => setSelectedNode(sync.documentId)}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                      {sync.documentName || "(unnamed sync)"}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                      {sync.state.projectName ??
                        sync.state.projectId ??
                        "no project set"}
                      {sync.state.lastCompletedAt
                        ? ` · last run ${formatRelative(sync.state.lastCompletedAt)}`
                        : ""}
                    </span>
                  </span>
                  <StatusPill status={sync.state.status} />
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
