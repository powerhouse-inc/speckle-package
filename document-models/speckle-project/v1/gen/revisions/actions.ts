/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { RemoveRevisionInput, UpsertRevisionInput } from "../types.js";

export type UpsertRevisionAction = Action & {
  type: "UPSERT_REVISION";
  input: UpsertRevisionInput;
};
export type RemoveRevisionAction = Action & {
  type: "REMOVE_REVISION";
  input: RemoveRevisionInput;
};

export type SpeckleProjectRevisionsAction =
  | UpsertRevisionAction
  | RemoveRevisionAction;
