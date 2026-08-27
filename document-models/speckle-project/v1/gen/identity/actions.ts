/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  ClearSyncedDataInput,
  SetProjectIdentityInput,
} from "../types.js";

export type SetProjectIdentityAction = Action & {
  type: "SET_PROJECT_IDENTITY";
  input: SetProjectIdentityInput;
};
export type ClearSyncedDataAction = Action & {
  type: "CLEAR_SYNCED_DATA";
  input: ClearSyncedDataInput;
};

export type SpeckleProjectIdentityAction =
  | SetProjectIdentityAction
  | ClearSyncedDataAction;
