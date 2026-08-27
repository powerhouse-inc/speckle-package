/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { SpeckleSyncGlobalState } from "../types.js";
import type {
  CancelRunAction,
  CompleteRunAction,
  FailRunAction,
  RequestSyncAction,
  StartRunAction,
} from "./actions.js";

export interface SpeckleSyncRunsOperations {
  requestSyncOperation: (
    state: SpeckleSyncGlobalState,
    action: RequestSyncAction,
    dispatch?: SignalDispatch,
  ) => void;
  startRunOperation: (
    state: SpeckleSyncGlobalState,
    action: StartRunAction,
    dispatch?: SignalDispatch,
  ) => void;
  completeRunOperation: (
    state: SpeckleSyncGlobalState,
    action: CompleteRunAction,
    dispatch?: SignalDispatch,
  ) => void;
  failRunOperation: (
    state: SpeckleSyncGlobalState,
    action: FailRunAction,
    dispatch?: SignalDispatch,
  ) => void;
  cancelRunOperation: (
    state: SpeckleSyncGlobalState,
    action: CancelRunAction,
    dispatch?: SignalDispatch,
  ) => void;
}
