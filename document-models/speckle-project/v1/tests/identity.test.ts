import { generateMock } from "document-model";
import {
  clearSyncedData,
  ClearSyncedDataInputSchema,
  isSpeckleProjectDocument,
  reducer,
  setProjectIdentity,
  SetProjectIdentityInputSchema,
  utils,
} from "document-models/speckle-project/v1";
import { describe, expect, it } from "vitest";

describe("IdentityOperations", () => {
  it("should handle setProjectIdentity operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetProjectIdentityInputSchema(), {
      serverUrl: "https://example.com",
      syncedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, setProjectIdentity(input));

    expect(isSpeckleProjectDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_PROJECT_IDENTITY",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle clearSyncedData operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ClearSyncedDataInputSchema());

    const updatedDocument = reducer(document, clearSyncedData(input));

    expect(isSpeckleProjectDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CLEAR_SYNCED_DATA",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
