/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  RemoveRevisionInputSchema,
  UpsertRevisionInputSchema,
} from "../schema/zod.js";
import type { RemoveRevisionInput, UpsertRevisionInput } from "../types.js";
import type { RemoveRevisionAction, UpsertRevisionAction } from "./actions.js";

export const upsertRevision = (input: UpsertRevisionInput) =>
  createAction<UpsertRevisionAction>(
    "UPSERT_REVISION",
    { ...input },
    undefined,
    UpsertRevisionInputSchema,
    "global",
  );

export const removeRevision = (input: RemoveRevisionInput) =>
  createAction<RemoveRevisionAction>(
    "REMOVE_REVISION",
    { ...input },
    undefined,
    RemoveRevisionInputSchema,
    "global",
  );
