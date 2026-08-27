/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { SpeckleProjectGlobalState } from "../types.js";
import type { RemoveModelAction, UpsertModelAction } from "./actions.js";

export interface SpeckleProjectModelsOperations {
  upsertModelOperation: (
    state: SpeckleProjectGlobalState,
    action: UpsertModelAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeModelOperation: (
    state: SpeckleProjectGlobalState,
    action: RemoveModelAction,
    dispatch?: SignalDispatch,
  ) => void;
}
