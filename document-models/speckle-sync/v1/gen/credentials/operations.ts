/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { SpeckleSyncLocalState } from "../types.js";
import type {
  ClearAccessTokenAction,
  SetAccessTokenAction,
} from "./actions.js";

export interface SpeckleSyncCredentialsOperations {
  setAccessTokenOperation: (
    state: SpeckleSyncLocalState,
    action: SetAccessTokenAction,
    dispatch?: SignalDispatch,
  ) => void;
  clearAccessTokenOperation: (
    state: SpeckleSyncLocalState,
    action: ClearAccessTokenAction,
    dispatch?: SignalDispatch,
  ) => void;
}
