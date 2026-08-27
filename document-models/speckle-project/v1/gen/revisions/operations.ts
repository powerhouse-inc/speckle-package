/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { SpeckleProjectGlobalState } from "../types.js";
import type { RemoveRevisionAction, UpsertRevisionAction } from "./actions.js";

export interface SpeckleProjectRevisionsOperations {
  upsertRevisionOperation: (
    state: SpeckleProjectGlobalState,
    action: UpsertRevisionAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeRevisionOperation: (
    state: SpeckleProjectGlobalState,
    action: RemoveRevisionAction,
    dispatch?: SignalDispatch,
  ) => void;
}
