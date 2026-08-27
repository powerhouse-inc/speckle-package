/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { SpeckleProjectGlobalState } from "../types.js";
import type { RecordChangeAction } from "./actions.js";

export interface SpeckleProjectChangesOperations {
  recordChangeOperation: (
    state: SpeckleProjectGlobalState,
    action: RecordChangeAction,
    dispatch?: SignalDispatch,
  ) => void;
}
