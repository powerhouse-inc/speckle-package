/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  CancelRunInput,
  CompleteRunInput,
  FailRunInput,
  RequestSyncInput,
  StartRunInput,
} from "../types.js";

export type RequestSyncAction = Action & {
  type: "REQUEST_SYNC";
  input: RequestSyncInput;
};
export type StartRunAction = Action & {
  type: "START_RUN";
  input: StartRunInput;
};
export type CompleteRunAction = Action & {
  type: "COMPLETE_RUN";
  input: CompleteRunInput;
};
export type FailRunAction = Action & { type: "FAIL_RUN"; input: FailRunInput };
export type CancelRunAction = Action & {
  type: "CANCEL_RUN";
  input: CancelRunInput;
};

export type SpeckleSyncRunsAction =
  | RequestSyncAction
  | StartRunAction
  | CompleteRunAction
  | FailRunAction
  | CancelRunAction;
