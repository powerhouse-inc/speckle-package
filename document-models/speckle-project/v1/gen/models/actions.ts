/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { RemoveModelInput, UpsertModelInput } from "../types.js";

export type UpsertModelAction = Action & {
  type: "UPSERT_MODEL";
  input: UpsertModelInput;
};
export type RemoveModelAction = Action & {
  type: "REMOVE_MODEL";
  input: RemoveModelInput;
};

export type SpeckleProjectModelsAction = UpsertModelAction | RemoveModelAction;
