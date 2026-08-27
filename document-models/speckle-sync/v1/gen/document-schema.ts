/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { speckleSyncDocumentType } from "./document-type.js";
import { SpeckleSyncStateSchema } from "./schema/zod.js";
import type { SpeckleSyncDocument, SpeckleSyncPHState } from "./types.js";

/** Schema for validating the header object of a SpeckleSync document */
export const SpeckleSyncDocumentHeaderSchema = BaseDocumentHeaderSchema.extend({
  documentType: z.literal(speckleSyncDocumentType),
});

/** Schema for validating the state object of a SpeckleSync document */
export const SpeckleSyncPHStateSchema = BaseDocumentStateSchema.extend({
  global: SpeckleSyncStateSchema(),
});

export const SpeckleSyncDocumentSchema = z.object({
  header: SpeckleSyncDocumentHeaderSchema,
  state: SpeckleSyncPHStateSchema,
  initialState: SpeckleSyncPHStateSchema,
});

/** Simple helper function to check if a state object is a SpeckleSync document state object */
export function isSpeckleSyncState(
  state: unknown,
): state is SpeckleSyncPHState {
  return SpeckleSyncPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a SpeckleSync document state object */
export function assertIsSpeckleSyncState(
  state: unknown,
): asserts state is SpeckleSyncPHState {
  SpeckleSyncPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a SpeckleSync document */
export function isSpeckleSyncDocument(
  document: unknown,
): document is SpeckleSyncDocument {
  return SpeckleSyncDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a SpeckleSync document */
export function assertIsSpeckleSyncDocument(
  document: unknown,
): asserts document is SpeckleSyncDocument {
  SpeckleSyncDocumentSchema.parse(document);
}
