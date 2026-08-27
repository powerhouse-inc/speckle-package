/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { SpeckleSyncGlobalState } from "../types.js";
import type {
  SetServerConnectionAction,
  SetSyncOptionsAction,
  SetTargetProjectDocumentAction,
} from "./actions.js";

export interface SpeckleSyncConnectionOperations {
  setServerConnectionOperation: (
    state: SpeckleSyncGlobalState,
    action: SetServerConnectionAction,
    dispatch?: SignalDispatch,
  ) => void;
  setTargetProjectDocumentOperation: (
    state: SpeckleSyncGlobalState,
    action: SetTargetProjectDocumentAction,
    dispatch?: SignalDispatch,
  ) => void;
  setSyncOptionsOperation: (
    state: SpeckleSyncGlobalState,
    action: SetSyncOptionsAction,
    dispatch?: SignalDispatch,
  ) => void;
}
