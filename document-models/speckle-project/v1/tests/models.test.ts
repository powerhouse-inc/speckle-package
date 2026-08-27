import { generateMock } from "document-model";
import {
  isSpeckleProjectDocument,
  reducer,
  removeModel,
  RemoveModelInputSchema,
  upsertModel,
  UpsertModelInputSchema,
  utils,
} from "document-models/speckle-project/v1";
import { describe, expect, it } from "vitest";

describe("ModelsOperations", () => {
  it("should handle upsertModel operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UpsertModelInputSchema(), {
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, upsertModel(input));

    expect(isSpeckleProjectDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "UPSERT_MODEL",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeModel operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveModelInputSchema());

    const updatedDocument = reducer(document, removeModel(input));

    expect(isSpeckleProjectDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REMOVE_MODEL",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
