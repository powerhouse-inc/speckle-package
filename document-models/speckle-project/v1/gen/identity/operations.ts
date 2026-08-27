/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { SpeckleProjectGlobalState } from "../types.js";
import type {
  ClearSyncedDataAction,
  SetProjectIdentityAction,
} from "./actions.js";

export interface SpeckleProjectIdentityOperations {
  setProjectIdentityOperation: (
    state: SpeckleProjectGlobalState,
    action: SetProjectIdentityAction,
    dispatch?: SignalDispatch,
  ) => void;
  clearSyncedDataOperation: (
    state: SpeckleProjectGlobalState,
    action: ClearSyncedDataAction,
    dispatch?: SignalDispatch,
  ) => void;
}
