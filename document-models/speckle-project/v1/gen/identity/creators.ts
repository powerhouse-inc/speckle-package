/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  ClearSyncedDataInputSchema,
  SetProjectIdentityInputSchema,
} from "../schema/zod.js";
import type {
  ClearSyncedDataInput,
  SetProjectIdentityInput,
} from "../types.js";
import type {
  ClearSyncedDataAction,
  SetProjectIdentityAction,
} from "./actions.js";

export const setProjectIdentity = (input: SetProjectIdentityInput) =>
  createAction<SetProjectIdentityAction>(
    "SET_PROJECT_IDENTITY",
    { ...input },
    undefined,
    SetProjectIdentityInputSchema,
    "global",
  );

export const clearSyncedData = (input: ClearSyncedDataInput) =>
  createAction<ClearSyncedDataAction>(
    "CLEAR_SYNCED_DATA",
    { ...input },
    undefined,
    ClearSyncedDataInputSchema,
    "global",
  );
