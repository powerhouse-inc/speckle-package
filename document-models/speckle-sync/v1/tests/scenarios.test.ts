import {
  cancelRun,
  clearAccessToken,
  completeRun,
  failRun,
  reducer,
  requestSync,
  setAccessToken,
  setServerConnection,
  setSyncOptions,
  setTargetProjectDocument,
  startRun,
  utils,
} from "document-models/speckle-sync/v1";
import { describe, expect, it } from "vitest";

const SERVER = "http://127.0.0.1";
const T1 = "2026-08-27T10:00:00.000Z";
const T2 = "2026-08-27T11:00:00.000Z";

function lastError(document: {
  operations: Record<string, { error?: string | null }[]>;
}): string | null | undefined {
  const ops = document.operations.global;
  return ops[ops.length - 1].error;
}

function lastLocalError(document: {
  operations: Record<string, { error?: string | null }[]>;
}): string | null | undefined {
  const ops = document.operations.local;
  return ops[ops.length - 1].error;
}

type Doc = ReturnType<typeof utils.createDocument>;

/** Configured far enough that a sync may be requested. */
function configured(): Doc {
  let document = reducer(
    utils.createDocument(),
    setServerConnection({
      serverUrl: SERVER,
      projectId: "be4c927cce",
      projectName: "Nordkai Bridge",
    }),
  );

  return reducer(
    document,
    setTargetProjectDocument({ targetProjectDocumentId: "phid-project" }),
  );
}

function requested(): Doc {
  return reducer(configured(), requestSync({ id: "run-1", requestedAt: T1 }));
}

function running(): Doc {
  return reducer(requested(), startRun({ runId: "run-1", startedAt: T1 }));
}

describe("connection", () => {
  it("binds server, project and sync target", () => {
    const fresh = utils.createDocument();

    expect(fresh.state.global.status).toBe("IDLE");
    expect(fresh.state.global.versionsPerModel).toBe(25);
    expect(fresh.state.global.maxObjectsPerVersion).toBe(5000);
    expect(fresh.state.global.autoSync).toBe(false);

    const document = configured();

    expect(document.state.global.projectId).toBe("be4c927cce");
    expect(document.state.global.projectName).toBe("Nordkai Bridge");
    expect(document.state.global.targetProjectDocumentId).toBe("phid-project");

    // Project name omitted -> the `|| null` branch.
    const bare = reducer(
      document,
      setServerConnection({ serverUrl: SERVER, projectId: "other" }),
    );

    expect(bare.state.global.projectName).toBeNull();
  });

  it("rejects a blank project id", () => {
    const failed = reducer(
      utils.createDocument(),
      setServerConnection({ serverUrl: SERVER, projectId: "   " }),
    );

    expect(lastError(failed)).toBe("A Speckle project id is required");
    expect(failed.state.global.projectId).toBeNull();
  });

  it("updates each sync option independently and validates its range", () => {
    let document = reducer(utils.createDocument(), setSyncOptions({ autoSync: true }));

    expect(document.state.global.autoSync).toBe(true);
    expect(document.state.global.versionsPerModel).toBe(25);

    document = reducer(document, setSyncOptions({ versionsPerModel: 50 }));
    expect(document.state.global.versionsPerModel).toBe(50);

    document = reducer(document, setSyncOptions({ maxObjectsPerVersion: 250 }));
    expect(document.state.global.maxObjectsPerVersion).toBe(250);

    // Nothing supplied -> every `if` falls through.
    const untouched = reducer(document, setSyncOptions({}));
    expect(untouched.state.global.versionsPerModel).toBe(50);
    expect(untouched.state.global.autoSync).toBe(true);

    for (const bad of [
      { versionsPerModel: 0 },
      { versionsPerModel: 201 },
    ]) {
      expect(lastError(reducer(document, setSyncOptions(bad)))).toBe(
        "versionsPerModel must be between 1 and 200",
      );
    }

    for (const bad of [
      { maxObjectsPerVersion: 0 },
      { maxObjectsPerVersion: 100001 },
    ]) {
      expect(lastError(reducer(document, setSyncOptions(bad)))).toBe(
        "maxObjectsPerVersion must be between 1 and 100000",
      );
    }
  });
});

describe("credentials live in local scope", () => {
  it("stores, relabels and clears the token", () => {
    let document = reducer(
      utils.createDocument(),
      setAccessToken({ accessToken: "tok-1", tokenLabel: "laptop" }),
    );

    expect(document.state.local.accessToken).toBe("tok-1");
    expect(document.state.local.tokenLabel).toBe("laptop");

    // No label -> the `|| null` branch.
    document = reducer(document, setAccessToken({ accessToken: "tok-2" }));
    expect(document.state.local.tokenLabel).toBeNull();

    const cleared = reducer(document, clearAccessToken({}));
    expect(cleared.state.local.accessToken).toBeNull();
    expect(cleared.state.local.tokenLabel).toBeNull();
  });

  it("rejects a blank token", () => {
    const failed = reducer(
      utils.createDocument(),
      setAccessToken({ accessToken: "  " }),
    );

    expect(lastLocalError(failed)).toBe("Access token must not be empty");
  });
});

describe("requesting a sync", () => {
  it("queues a pending run", () => {
    const document = requested();

    expect(document.state.global.status).toBe("REQUESTED");
    expect(document.state.global.lastRequestedAt).toBe(T1);
    expect(document.state.global.runs).toHaveLength(1);

    const run = document.state.global.runs[0];

    expect(run.outcome).toBe("PENDING");
    // Incremental unless asked otherwise.
    expect(run.fullResync).toBe(false);
    expect(run.startedAt).toBeNull();
    expect(run.finishedAt).toBeNull();
    expect(run.objectsScanned).toBe(0);
    expect(run.message).toBeNull();
  });

  it("refuses without a project or without a target document", () => {
    expect(
      lastError(
        reducer(utils.createDocument(), requestSync({ id: "r", requestedAt: T1 })),
      ),
    ).toBe(
      "Set the Speckle project and the target project document before syncing",
    );

    const projectOnly = reducer(
      utils.createDocument(),
      setServerConnection({ serverUrl: SERVER, projectId: "p" }),
    );

    expect(
      lastError(reducer(projectOnly, requestSync({ id: "r", requestedAt: T1 }))),
    ).toBe(
      "Set the Speckle project and the target project document before syncing",
    );
  });

  it("refuses while a sync is already requested or running", () => {
    expect(
      lastError(reducer(requested(), requestSync({ id: "run-2", requestedAt: T2 }))),
    ).toBe("A sync is already REQUESTED");

    expect(
      lastError(reducer(running(), requestSync({ id: "run-2", requestedAt: T2 }))),
    ).toBe("A sync is already RUNNING");
  });

  it("refuses a duplicate run id", () => {
    // Finish the first run so the status no longer blocks, then reuse its id.
    const finished = reducer(
      running(),
      completeRun({
        runId: "run-1",
        finishedAt: T2,
        modelsSeen: 1,
        versionsSeen: 2,
        versionsAdded: 2,
        objectsScanned: 71,
      }),
    );

    expect(
      lastError(reducer(finished, requestSync({ id: "run-1", requestedAt: T2 }))),
    ).toBe("Run run-1 already exists");
  });
});

describe("run lifecycle", () => {
  it("starts, completes and records what the run saw", () => {
    const started = running();

    expect(started.state.global.status).toBe("RUNNING");
    expect(started.state.global.runs[0].startedAt).toBe(T1);

    const done = reducer(
      started,
      completeRun({
        runId: "run-1",
        finishedAt: T2,
        modelsSeen: 1,
        versionsSeen: 2,
        versionsAdded: 2,
        objectsScanned: 71,
        message: "Mirrored 2 new revision(s)",
      }),
    );

    const run = done.state.global.runs[0];

    expect(done.state.global.status).toBe("IDLE");
    expect(done.state.global.lastCompletedAt).toBe(T2);
    expect(done.state.global.lastError).toBeNull();
    expect(run.outcome).toBe("SUCCESS");
    expect(run.versionsAdded).toBe(2);
    expect(run.objectsScanned).toBe(71);
    expect(run.message).toBe("Mirrored 2 new revision(s)");

    // No message -> the `|| null` branch.
    const quiet = reducer(
      running(),
      completeRun({
        runId: "run-1",
        finishedAt: T2,
        modelsSeen: 0,
        versionsSeen: 0,
        versionsAdded: 0,
        objectsScanned: 0,
      }),
    );

    expect(quiet.state.global.runs[0].message).toBeNull();
  });

  it("records a failure with its reason", () => {
    const failed = reducer(
      running(),
      failRun({
        runId: "run-1",
        finishedAt: T2,
        message: "Speckle responded 502 Bad Gateway",
      }),
    );

    expect(failed.state.global.status).toBe("FAILED");
    expect(failed.state.global.lastError).toBe(
      "Speckle responded 502 Bad Gateway",
    );
    expect(failed.state.global.runs[0].outcome).toBe("FAILURE");

    // A failed sync does not block the next request.
    const retried = reducer(failed, requestSync({ id: "run-2", requestedAt: T2 }));

    expect(retried.state.global.status).toBe("REQUESTED");
    expect(retried.state.global.lastError).toBeNull();
    expect(retried.state.global.runs).toHaveLength(2);
    // Newest first.
    expect(retried.state.global.runs[0].id).toBe("run-2");
  });

  it("guards every transition against a missing or finished run", () => {
    const pending = requested();

    expect(lastError(reducer(pending, startRun({ runId: "nope", startedAt: T1 })))).toBe(
      "Run nope not found",
    );

    expect(
      lastError(
        reducer(
          pending,
          completeRun({
            runId: "nope",
            finishedAt: T2,
            modelsSeen: 0,
            versionsSeen: 0,
            versionsAdded: 0,
            objectsScanned: 0,
          }),
        ),
      ),
    ).toBe("Run nope not found");

    expect(
      lastError(reducer(pending, failRun({ runId: "nope", finishedAt: T2, message: "x" }))),
    ).toBe("Run nope not found");

    // Completing before starting.
    expect(
      lastError(
        reducer(
          pending,
          completeRun({
            runId: "run-1",
            finishedAt: T2,
            modelsSeen: 0,
            versionsSeen: 0,
            versionsAdded: 0,
            objectsScanned: 0,
          }),
        ),
      ),
    ).toBe("Run run-1 is not running");

    // Starting twice.
    expect(
      lastError(reducer(running(), startRun({ runId: "run-1", startedAt: T2 }))),
    ).toBe("Run run-1 is not pending");

    // Failing a run that already succeeded.
    const done = reducer(
      running(),
      completeRun({
        runId: "run-1",
        finishedAt: T2,
        modelsSeen: 0,
        versionsSeen: 0,
        versionsAdded: 0,
        objectsScanned: 0,
      }),
    );

    expect(
      lastError(reducer(done, failRun({ runId: "run-1", finishedAt: T2, message: "late" }))),
    ).toBe("Run run-1 has already finished");

    // Completing a run that already succeeded.
    expect(
      lastError(
        reducer(
          done,
          completeRun({
            runId: "run-1",
            finishedAt: T2,
            modelsSeen: 0,
            versionsSeen: 0,
            versionsAdded: 0,
            objectsScanned: 0,
          }),
        ),
      ),
    ).toBe("Run run-1 is not running");
  });

  it("requires a reason to fail a run", () => {
    expect(
      lastError(reducer(running(), failRun({ runId: "run-1", finishedAt: T2, message: " " }))),
    ).toBe("A failed run must record a reason");
  });
});

describe("cancelling a stuck run", () => {
  it("abandons a requested run and unblocks the next request", () => {
    const cancelled = reducer(
      requested(),
      cancelRun({
        runId: "run-1",
        cancelledAt: T2,
        reason: "the runner never picked it up",
      }),
    );

    const run = cancelled.state.global.runs[0];

    expect(run.outcome).toBe("CANCELLED");
    expect(run.finishedAt).toBe(T2);
    expect(run.message).toBe("the runner never picked it up");
    // A cancellation is a decision, not a fault.
    expect(cancelled.state.global.status).toBe("IDLE");
    expect(cancelled.state.global.lastError).toBeNull();

    // Which is the entire point: the next sync can be requested.
    const retried = reducer(cancelled, requestSync({ id: "run-2", requestedAt: T2 }));

    expect(retried.state.global.status).toBe("REQUESTED");
    expect(retried.state.global.runs).toHaveLength(2);
  });

  it("abandons a run that had already started", () => {
    const cancelled = reducer(
      running(),
      cancelRun({ runId: "run-1", cancelledAt: T2, reason: "took too long" }),
    );

    expect(cancelled.state.global.runs[0].outcome).toBe("CANCELLED");
    expect(cancelled.state.global.status).toBe("IDLE");
  });

  it("refuses an unknown run, a blank reason, and a finished run", () => {
    expect(
      lastError(
        reducer(
          requested(),
          cancelRun({ runId: "nope", cancelledAt: T2, reason: "x" }),
        ),
      ),
    ).toBe("Run nope not found");

    expect(
      lastError(
        reducer(
          requested(),
          cancelRun({ runId: "run-1", cancelledAt: T2, reason: "  " }),
        ),
      ),
    ).toBe("A cancelled run must record a reason");

    const done = reducer(
      running(),
      completeRun({
        runId: "run-1",
        finishedAt: T2,
        modelsSeen: 0,
        versionsSeen: 0,
        versionsAdded: 0,
        objectsScanned: 0,
      }),
    );

    expect(
      lastError(
        reducer(
          done,
          cancelRun({ runId: "run-1", cancelledAt: T2, reason: "too late" }),
        ),
      ),
    ).toBe("Run run-1 has already finished");
  });
});

describe("full resync", () => {
  it("marks the run so the runner ignores its cache", () => {
    const document = reducer(
      configured(),
      requestSync({ id: "run-full", requestedAt: T1, fullResync: true }),
    );

    expect(document.state.global.runs[0].fullResync).toBe(true);
  });
});
