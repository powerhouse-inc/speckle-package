/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { RecordChangeInput } from "../types.js";

export type RecordChangeAction = Action & {
  type: "RECORD_CHANGE";
  input: RecordChangeInput;
};

export type SpeckleProjectChangesAction = RecordChangeAction;
