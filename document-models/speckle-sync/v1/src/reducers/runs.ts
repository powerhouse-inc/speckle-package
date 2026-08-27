import type { SpeckleSyncRunsOperations } from "document-models/speckle-sync/v1";
import {
  DuplicateRunError,
  MissingCancelReasonError,
  MissingFailureMessageError,
  NotConfiguredError,
  RunAlreadyFinishedError,
  RunNotFoundError,
  RunNotPendingError,
  RunNotRunningError,
  SyncAlreadyRunningError,
} from "../../gen/runs/error.js";

export const speckleSyncRunsOperations: SpeckleSyncRunsOperations = {
  requestSyncOperation(state, action) {
    if (!state.projectId || !state.targetProjectDocumentId) {
      throw new NotConfiguredError(
        "Set the Speckle project and the target project document before syncing",
      );
    }

    if (state.status === "REQUESTED" || state.status === "RUNNING") {
      throw new SyncAlreadyRunningError(`A sync is already ${state.status}`);
    }

    if (state.runs.some((r) => r.id === action.input.id)) {
      throw new DuplicateRunError(`Run ${action.input.id} already exists`);
    }

    state.status = "REQUESTED";
    state.lastRequestedAt = action.input.requestedAt;
    state.lastError = null;

    state.runs.unshift({
      id: action.input.id,
      requestedAt: action.input.requestedAt,
      startedAt: null,
      finishedAt: null,
      outcome: "PENDING",
      // A full resync makes the runner ignore what it believes it has already
      // pulled and walk every revision again.
      fullResync: action.input.fullResync ?? false,
      modelsSeen: 0,
      versionsSeen: 0,
      versionsAdded: 0,
      objectsScanned: 0,
      message: null,
    });
  },
  startRunOperation(state, action) {
    const run = state.runs.find((r) => r.id === action.input.runId);

    if (!run) {
      throw new RunNotFoundError(`Run ${action.input.runId} not found`);
    }

    if (run.outcome !== "PENDING" || run.startedAt) {
      throw new RunNotPendingError(`Run ${action.input.runId} is not pending`);
    }

    run.startedAt = action.input.startedAt;
    state.status = "RUNNING";
  },
  completeRunOperation(state, action) {
    const run = state.runs.find((r) => r.id === action.input.runId);

    if (!run) {
      throw new RunNotFoundError(`Run ${action.input.runId} not found`);
    }

    if (!run.startedAt || run.outcome !== "PENDING") {
      throw new RunNotRunningError(`Run ${action.input.runId} is not running`);
    }

    run.finishedAt = action.input.finishedAt;
    run.outcome = "SUCCESS";
    run.modelsSeen = action.input.modelsSeen;
    run.versionsSeen = action.input.versionsSeen;
    run.versionsAdded = action.input.versionsAdded;
    run.objectsScanned = action.input.objectsScanned;
    run.message = action.input.message || null;

    state.status = "IDLE";
    state.lastCompletedAt = action.input.finishedAt;
    state.lastError = null;
  },
  failRunOperation(state, action) {
    const run = state.runs.find((r) => r.id === action.input.runId);

    if (!run) {
      throw new RunNotFoundError(`Run ${action.input.runId} not found`);
    }

    if (!action.input.message.trim()) {
      throw new MissingFailureMessageError("A failed run must record a reason");
    }

    if (run.outcome !== "PENDING") {
      throw new RunNotRunningError(
        `Run ${action.input.runId} has already finished`,
      );
    }

    run.finishedAt = action.input.finishedAt;
    run.outcome = "FAILURE";
    run.message = action.input.message;

    state.status = "FAILED";
    state.lastError = action.input.message;
  },
  cancelRunOperation(state, action) {
    const run = state.runs.find((r) => r.id === action.input.runId);

    if (!run) {
      throw new RunNotFoundError(`Run ${action.input.runId} not found`);
    }

    if (!action.input.reason.trim()) {
      throw new MissingCancelReasonError(
        "A cancelled run must record a reason",
      );
    }

    if (run.outcome !== "PENDING") {
      throw new RunAlreadyFinishedError(
        `Run ${action.input.runId} has already finished`,
      );
    }

    run.finishedAt = action.input.cancelledAt;
    run.outcome = "CANCELLED";
    run.message = action.input.reason;

    // Back to IDLE rather than FAILED: a cancellation is a decision, not a fault,
    // and the whole point is to unblock the next request.
    state.status = "IDLE";
    state.lastError = null;
  },
};
