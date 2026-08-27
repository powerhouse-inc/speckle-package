import { generateMock } from "document-model";
import {
  isSpeckleSyncDocument,
  reducer,
  setServerConnection,
  SetServerConnectionInputSchema,
  setSyncOptions,
  SetSyncOptionsInputSchema,
  setTargetProjectDocument,
  SetTargetProjectDocumentInputSchema,
  utils,
} from "document-models/speckle-sync/v1";
import { describe, expect, it } from "vitest";

describe("ConnectionOperations", () => {
  it("should handle setServerConnection operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetServerConnectionInputSchema(), {
      serverUrl: "https://example.com",
    });

    const updatedDocument = reducer(document, setServerConnection(input));

    expect(isSpeckleSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_SERVER_CONNECTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setTargetProjectDocument operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetTargetProjectDocumentInputSchema());

    const updatedDocument = reducer(document, setTargetProjectDocument(input));

    expect(isSpeckleSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_TARGET_PROJECT_DOCUMENT",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setSyncOptions operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetSyncOptionsInputSchema());

    const updatedDocument = reducer(document, setSyncOptions(input));

    expect(isSpeckleSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_SYNC_OPTIONS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
