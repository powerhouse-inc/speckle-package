/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { speckleProjectDocumentType } from "./document-type.js";
import { SpeckleProjectStateSchema } from "./schema/zod.js";
import type { SpeckleProjectDocument, SpeckleProjectPHState } from "./types.js";

/** Schema for validating the header object of a SpeckleProject document */
export const SpeckleProjectDocumentHeaderSchema =
  BaseDocumentHeaderSchema.extend({
    documentType: z.literal(speckleProjectDocumentType),
  });

/** Schema for validating the state object of a SpeckleProject document */
export const SpeckleProjectPHStateSchema = BaseDocumentStateSchema.extend({
  global: SpeckleProjectStateSchema(),
});

export const SpeckleProjectDocumentSchema = z.object({
  header: SpeckleProjectDocumentHeaderSchema,
  state: SpeckleProjectPHStateSchema,
  initialState: SpeckleProjectPHStateSchema,
});

/** Simple helper function to check if a state object is a SpeckleProject document state object */
export function isSpeckleProjectState(
  state: unknown,
): state is SpeckleProjectPHState {
  return SpeckleProjectPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a SpeckleProject document state object */
export function assertIsSpeckleProjectState(
  state: unknown,
): asserts state is SpeckleProjectPHState {
  SpeckleProjectPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a SpeckleProject document */
export function isSpeckleProjectDocument(
  document: unknown,
): document is SpeckleProjectDocument {
  return SpeckleProjectDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a SpeckleProject document */
export function assertIsSpeckleProjectDocument(
  document: unknown,
): asserts document is SpeckleProjectDocument {
  SpeckleProjectDocumentSchema.parse(document);
}
