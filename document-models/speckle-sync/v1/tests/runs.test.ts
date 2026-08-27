import { generateMock } from "document-model";
import {
  cancelRun,
  CancelRunInputSchema,
  completeRun,
  CompleteRunInputSchema,
  failRun,
  FailRunInputSchema,
  isSpeckleSyncDocument,
  reducer,
  requestSync,
  RequestSyncInputSchema,
  startRun,
  StartRunInputSchema,
  utils,
} from "document-models/speckle-sync/v1";
import { describe, expect, it } from "vitest";

describe("RunsOperations", () => {
  it("should handle requestSync operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RequestSyncInputSchema(), {
      requestedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, requestSync(input));

    expect(isSpeckleSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REQUEST_SYNC",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle startRun operation", () => {
    const document = utils.createDocument();
    const input = generateMock(StartRunInputSchema(), {
      startedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, startRun(input));

    expect(isSpeckleSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("START_RUN");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle completeRun operation", () => {
    const document = utils.createDocument();
    const input = generateMock(CompleteRunInputSchema(), {
      finishedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, completeRun(input));

    expect(isSpeckleSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "COMPLETE_RUN",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle failRun operation", () => {
    const document = utils.createDocument();
    const input = generateMock(FailRunInputSchema(), {
      finishedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, failRun(input));

    expect(isSpeckleSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("FAIL_RUN");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle cancelRun operation", () => {
    const document = utils.createDocument();
    const input = generateMock(CancelRunInputSchema());

    const updatedDocument = reducer(document, cancelRun(input));

    expect(isSpeckleSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("CANCEL_RUN");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
