import { useState } from "react";
import {
  fetchProjectOverview,
  type SpeckleProjectOverview,
} from "../../shared/speckle.js";
import { Banner, Button, Cell, Chip, Row, Table } from "../../shared/ui.js";
import { formatRelative } from "../../shared/format.js";

/**
 * Reads the project straight from Speckle, before any sync runs.
 *
 * Two jobs: prove the server URL, project id and token actually work, and show
 * what is over there so the numbers in the mirror can be checked against the
 * source.
 */
export function ProjectProbe({
  serverUrl,
  projectId,
  token,
  onProjectName,
}: {
  serverUrl: string;
  projectId: string;
  token: string | null;
  onProjectName: (name: string) => void;
}) {
  const [overview, setOverview] = useState<SpeckleProjectOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function probe() {
    setBusy(true);
    setError(null);

    try {
      const result = await fetchProjectOverview(serverUrl, projectId, token);

      setOverview(result);

      // The name is worth keeping in the document so it reads properly even
      // when Speckle is unreachable.
      if (result.name) onProjectName(result.name);
    } catch (cause) {
      setOverview(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => void probe()}
          disabled={busy || !serverUrl || !projectId}
          variant="secondary"
        >
          {busy ? "Checking…" : "Check Speckle"}
        </Button>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Reads the project live from Speckle — nothing is written.
        </span>
      </div>

      {error && (
        <Banner tone="error" onDismiss={() => setError(null)}>
          <strong>Speckle said no.</strong> {error}
        </Banner>
      )}

      {overview && (
        <div className="flex flex-col gap-2">
          <Banner tone="success">
            <strong>{overview.name}</strong> · {overview.models.length} model
            {overview.models.length === 1 ? "" : "s"}
            {overview.visibility ? ` · ${overview.visibility.toLowerCase()}` : ""}
          </Banner>

          {overview.models.length > 0 && (
            <Table headers={["Model", "Id", "Updated"]}>
              {overview.models.map((model) => (
                <Row key={model.id}>
                  <Cell className="font-medium text-slate-900 dark:text-slate-100">
                    {model.displayName ?? model.name}
                  </Cell>
                  <Cell>
                    <Chip mono>{model.id}</Chip>
                  </Cell>
                  <Cell className="text-slate-500 dark:text-slate-400">
                    {formatRelative(model.updatedAt)}
                  </Cell>
                </Row>
              ))}
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
