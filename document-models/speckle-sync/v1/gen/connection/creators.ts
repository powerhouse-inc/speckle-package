/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  SetServerConnectionInputSchema,
  SetSyncOptionsInputSchema,
  SetTargetProjectDocumentInputSchema,
} from "../schema/zod.js";
import type {
  SetServerConnectionInput,
  SetSyncOptionsInput,
  SetTargetProjectDocumentInput,
} from "../types.js";
import type {
  SetServerConnectionAction,
  SetSyncOptionsAction,
  SetTargetProjectDocumentAction,
} from "./actions.js";

export const setServerConnection = (input: SetServerConnectionInput) =>
  createAction<SetServerConnectionAction>(
    "SET_SERVER_CONNECTION",
    { ...input },
    undefined,
    SetServerConnectionInputSchema,
    "global",
  );

export const setTargetProjectDocument = (
  input: SetTargetProjectDocumentInput,
) =>
  createAction<SetTargetProjectDocumentAction>(
    "SET_TARGET_PROJECT_DOCUMENT",
    { ...input },
    undefined,
    SetTargetProjectDocumentInputSchema,
    "global",
  );

export const setSyncOptions = (input: SetSyncOptionsInput) =>
  createAction<SetSyncOptionsAction>(
    "SET_SYNC_OPTIONS",
    { ...input },
    undefined,
    SetSyncOptionsInputSchema,
    "global",
  );
