import { DocumentToolbar } from "@powerhousedao/design-system/connect/index";
import { setSelectedNode } from "@powerhousedao/reactor-browser";
import { generateId } from "document-model";
import { useSpeckleProjectDocumentsInSelectedDrive } from "document-models/speckle-project";
import {
  actions,
  useSelectedSpeckleSyncDocument,
} from "document-models/speckle-sync";
import { useEffect, useState } from "react";
import { formatDateTime, formatRelative } from "../shared/format.js";
import { DEFAULT_SPECKLE_BASE } from "../shared/speckle.js";
import {
  Banner,
  Button,
  Card,
  Chip,
  FieldLabel,
  KpiTile,
  NumberCell,
  StatusPill,
  TextInput,
  Toggle,
} from "../shared/ui.js";
import { ProjectProbe } from "./components/project-probe.js";
import { RunLog } from "./components/run-log.js";

export default function Editor() {
  const [document, dispatch] = useSelectedSpeckleSyncDocument();
  const state = document.state.global;
  const local = document.state.local;

  const mirrors = useSpeckleProjectDocumentsInSelectedDrive();

  const [serverUrl, setServerUrl] = useState(
    state.serverUrl ?? DEFAULT_SPECKLE_BASE,
  );
  const [projectId, setProjectId] = useState(state.projectId ?? "");
  const [projectName, setProjectName] = useState(state.projectName ?? "");
  const [token, setToken] = useState("");
  const [tokenLabel, setTokenLabel] = useState(local.tokenLabel ?? "");

  // Follow the document when it changes underneath us — the processor writes to
  // it, and another collaborator may edit the connection.
  useEffect(() => {
    setServerUrl(state.serverUrl ?? DEFAULT_SPECKLE_BASE);
    setProjectId(state.projectId ?? "");
    setProjectName(state.projectName ?? "");
  }, [state.serverUrl, state.projectId, state.projectName]);

  const connectionDirty =
    serverUrl !== (state.serverUrl ?? DEFAULT_SPECKLE_BASE) ||
    projectId !== (state.projectId ?? "") ||
    projectName !== (state.projectName ?? "");

  const busy = state.status === "REQUESTED" || state.status === "RUNNING";
  const configured = Boolean(state.projectId && state.targetProjectDocumentId);
  const lastRun = state.runs.at(0) ?? null;

  function saveConnection() {
    dispatch(
      actions.setServerConnection({
        serverUrl,
        projectId: projectId.trim(),
        projectName: projectName.trim() || undefined,
      }),
    );
  }

  function runSync(fullResync = false) {
    dispatch(
      actions.requestSync({
        id: generateId(),
        requestedAt: new Date().toISOString(),
        fullResync,
      }),
    );
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <DocumentToolbar />

      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
        {/* ------------------------------------------------------- header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              {state.projectName ?? state.projectId ?? "Speckle sync"}
              <StatusPill status={state.status} />
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pulls a Speckle project's models, revisions and quantities into a
              Powerhouse document, and records what changed between revisions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {state.targetProjectDocumentId && (
              <Button
                variant="secondary"
                onClick={() => setSelectedNode(state.targetProjectDocumentId!)}
                title="Open the mirrored project document"
              >
                Open the mirror →
              </Button>
            )}
            {busy && lastRun && lastRun.outcome === "PENDING" && (
              <Button
                variant="danger"
                onClick={() =>
                  dispatch(
                    actions.cancelRun({
                      runId: lastRun.id,
                      cancelledAt: new Date().toISOString(),
                      reason: "cancelled from the console",
                    }),
                  )
                }
                title="Abandon this run so a new sync can be requested"
              >
                Cancel run
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => runSync(true)}
              disabled={busy || !configured}
              title="Re-walk every revision, ignoring what the runner believes it already pulled"
            >
              Full resync
            </Button>
            <Button
              variant="primary"
              onClick={() => runSync()}
              disabled={busy || !configured}
              title={
                configured
                  ? "Request a sync — the processor picks it up"
                  : "Set a project and a target document first"
              }
            >
              {busy ? "Syncing…" : "Run sync"}
            </Button>
          </div>
        </header>

        {state.lastError && (
          <Banner tone="error">
            <strong>Last sync failed.</strong> {state.lastError}
          </Banner>
        )}

        {busy && (
          <Banner tone="info">
            A sync is {state.status.toLowerCase()}. The runner processes it in
            the background and writes straight into the mirror document.
          </Banner>
        )}

        {/* ---------------------------------------------------------- KPIs */}
        <div className="flex flex-wrap gap-2">
          <KpiTile
            label="Syncs run"
            value={state.runs.length.toLocaleString()}
            hint={
              lastRun
                ? `last ${lastRun.outcome.toLowerCase()}`
                : "none yet"
            }
          />
          <KpiTile
            label="Last completed"
            value={formatRelative(state.lastCompletedAt)}
            hint={formatDateTime(state.lastCompletedAt)}
          />
          <KpiTile
            label="Revisions added"
            value={(lastRun?.versionsAdded ?? 0).toLocaleString()}
            hint="in the last run"
            tone={(lastRun?.versionsAdded ?? 0) > 0 ? "positive" : "neutral"}
          />
          <KpiTile
            label="Objects walked"
            value={(lastRun?.objectsScanned ?? 0).toLocaleString()}
            hint="in the last run"
          />
        </div>

        {/* --------------------------------------------------- connection */}
        <Card
          title="Speckle connection"
          subtitle="Which server and project this document mirrors"
          actions={
            <Button
              variant={connectionDirty ? "primary" : "secondary"}
              onClick={saveConnection}
              disabled={!connectionDirty || !projectId.trim()}
            >
              {connectionDirty ? "Save" : "Saved"}
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <FieldLabel>Server URL</FieldLabel>
                <TextInput
                  value={serverUrl}
                  onChange={setServerUrl}
                  placeholder="https://app.speckle.systems"
                  mono
                />
              </label>
              <label className="flex flex-col gap-1">
                <FieldLabel>Project id</FieldLabel>
                <TextInput
                  value={projectId}
                  onChange={setProjectId}
                  placeholder="be4c927cce"
                  mono
                />
              </label>
              <label className="flex flex-col gap-1">
                <FieldLabel>Project name</FieldLabel>
                <TextInput
                  value={projectName}
                  onChange={setProjectName}
                  placeholder="filled in by the check below"
                />
              </label>
            </div>

            <ProjectProbe
              serverUrl={serverUrl}
              projectId={projectId.trim()}
              token={local.accessToken ?? null}
              onProjectName={setProjectName}
            />
          </div>
        </Card>

        {/* ------------------------------------------------------- target */}
        <Card
          title="Mirror document"
          subtitle="Where the synced project data is written"
        >
          {mirrors && mirrors.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {mirrors.map((mirror) => {
                const selected =
                  mirror.header.id === state.targetProjectDocumentId;

                return (
                  <button
                    key={mirror.header.id}
                    type="button"
                    onClick={() =>
                      dispatch(
                        actions.setTargetProjectDocument({
                          targetProjectDocumentId: mirror.header.id,
                        }),
                      )
                    }
                    className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      selected
                        ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950"
                        : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                        {mirror.header.name || "(unnamed)"}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                        {mirror.state.global.revisions.length} revision
                        {mirror.state.global.revisions.length === 1 ? "" : "s"}
                        {mirror.state.global.projectId
                          ? ` · ${mirror.state.global.projectId}`
                          : " · empty"}
                      </span>
                    </span>
                    {selected && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                        target
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No Speckle Project document on this drive yet. Create one, then
              pick it here — the sync writes into it.
            </p>
          )}
        </Card>

        {/* -------------------------------------------------- credentials */}
        <Card
          title="Your access token"
          subtitle="Private to you — stored in this document's local scope"
          actions={
            local.accessToken && (
              <Button
                variant="danger"
                onClick={() => dispatch(actions.clearAccessToken({}))}
              >
                Clear
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
              <label className="flex flex-col gap-1">
                <FieldLabel>Personal access token</FieldLabel>
                <TextInput
                  value={token}
                  onChange={setToken}
                  type="password"
                  placeholder={
                    local.accessToken ? "•••••••• (stored)" : "speckle PAT"
                  }
                  mono
                />
              </label>
              <label className="flex flex-col gap-1">
                <FieldLabel>Label</FieldLabel>
                <TextInput
                  value={tokenLabel}
                  onChange={setTokenLabel}
                  placeholder="laptop"
                />
              </label>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  disabled={!token.trim()}
                  onClick={() => {
                    dispatch(
                      actions.setAccessToken({
                        accessToken: token.trim(),
                        tokenLabel: tokenLabel.trim() || undefined,
                      }),
                    );
                    setToken("");
                  }}
                >
                  Store
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {local.accessToken ? (
                <>
                  <Chip>token stored</Chip>
                  {local.tokenLabel && <Chip>{local.tokenLabel}</Chip>}
                </>
              ) : (
                <Chip>no token</Chip>
              )}
              <span>
                Local scope means this never reaches other collaborators. It is
                used for the live checks in this editor only — the background
                runner authenticates with the reactor's own service credential,
                never with yours.
              </span>
            </div>
          </div>
        </Card>

        {/* ------------------------------------------------------ options */}
        <Card
          title="Sync options"
          subtitle="How deep each run walks the Speckle graph"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <FieldLabel>Versions per model</FieldLabel>
              <NumberCell
                value={state.versionsPerModel}
                min={1}
                max={200}
                align="left"
                onCommit={(next) =>
                  dispatch(actions.setSyncOptions({ versionsPerModel: next }))
                }
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Newest first. Older revisions stay in Speckle.
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <FieldLabel>Max objects per revision</FieldLabel>
              <NumberCell
                value={state.maxObjectsPerVersion}
                min={1}
                max={100000}
                align="left"
                onCommit={(next) =>
                  dispatch(
                    actions.setSyncOptions({ maxObjectsPerVersion: next }),
                  )
                }
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                A cap, not a target. Capped revisions are marked partial.
              </span>
            </label>

            <div className="flex flex-col gap-1">
              <FieldLabel>Auto sync</FieldLabel>
              <span className="flex items-center gap-2">
                <Toggle
                  checked={state.autoSync}
                  onChange={(next) =>
                    dispatch(actions.setSyncOptions({ autoSync: next }))
                  }
                  label="Sync whenever Speckle reports a new version"
                />
                <span className="text-xs">
                  {state.autoSync ? "on" : "off"}
                </span>
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Requires a webhook from Speckle into the reactor.
              </span>
            </div>
          </div>
        </Card>

        {/* --------------------------------------------------------- runs */}
        <Card
          title="Sync history"
          subtitle={`${state.runs.length} run${state.runs.length === 1 ? "" : "s"} recorded in this document`}
        >
          <RunLog runs={state.runs} />
        </Card>
      </div>
    </div>
  );
}
