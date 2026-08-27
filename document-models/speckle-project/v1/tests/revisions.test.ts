import { generateMock } from "document-model";
import {
  isSpeckleProjectDocument,
  reducer,
  removeRevision,
  RemoveRevisionInputSchema,
  upsertRevision,
  UpsertRevisionInputSchema,
  utils,
} from "document-models/speckle-project/v1";
import { describe, expect, it } from "vitest";

describe("RevisionsOperations", () => {
  it("should handle upsertRevision operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UpsertRevisionInputSchema(), {
      createdAt: "2024-01-01T00:00:00.000Z",
      previewUrl: "https://example.com",
      syncedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, upsertRevision(input));

    expect(isSpeckleProjectDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "UPSERT_REVISION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeRevision operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveRevisionInputSchema());

    const updatedDocument = reducer(document, removeRevision(input));

    expect(isSpeckleProjectDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REMOVE_REVISION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
