import { generateMock } from "document-model";
import {
  clearAccessToken,
  ClearAccessTokenInputSchema,
  isSpeckleSyncDocument,
  reducer,
  setAccessToken,
  SetAccessTokenInputSchema,
  utils,
} from "document-models/speckle-sync/v1";
import { describe, expect, it } from "vitest";

describe("CredentialsOperations", () => {
  it("should handle setAccessToken operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetAccessTokenInputSchema());

    const updatedDocument = reducer(document, setAccessToken(input));

    expect(isSpeckleSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.local).toHaveLength(1);
    expect(updatedDocument.operations.local[0].action.type).toBe(
      "SET_ACCESS_TOKEN",
    );
    expect(updatedDocument.operations.local[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.local[0].index).toEqual(0);
  });

  it("should handle clearAccessToken operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ClearAccessTokenInputSchema());

    const updatedDocument = reducer(document, clearAccessToken(input));

    expect(isSpeckleSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.local).toHaveLength(1);
    expect(updatedDocument.operations.local[0].action.type).toBe(
      "CLEAR_ACCESS_TOKEN",
    );
    expect(updatedDocument.operations.local[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.local[0].index).toEqual(0);
  });
});
