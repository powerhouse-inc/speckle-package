import { generateMock } from "document-model";
import {
  isSpeckleProjectDocument,
  recordChange,
  RecordChangeInputSchema,
  reducer,
  utils,
} from "document-models/speckle-project/v1";
import { describe, expect, it } from "vitest";

describe("ChangesOperations", () => {
  it("should handle recordChange operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RecordChangeInputSchema(), {
      detectedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, recordChange(input));

    expect(isSpeckleProjectDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "RECORD_CHANGE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
