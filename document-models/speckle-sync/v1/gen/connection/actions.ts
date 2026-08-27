/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  SetServerConnectionInput,
  SetSyncOptionsInput,
  SetTargetProjectDocumentInput,
} from "../types.js";

export type SetServerConnectionAction = Action & {
  type: "SET_SERVER_CONNECTION";
  input: SetServerConnectionInput;
};
export type SetTargetProjectDocumentAction = Action & {
  type: "SET_TARGET_PROJECT_DOCUMENT";
  input: SetTargetProjectDocumentInput;
};
export type SetSyncOptionsAction = Action & {
  type: "SET_SYNC_OPTIONS";
  input: SetSyncOptionsInput;
};

export type SpeckleSyncConnectionAction =
  | SetServerConnectionAction
  | SetTargetProjectDocumentAction
  | SetSyncOptionsAction;
