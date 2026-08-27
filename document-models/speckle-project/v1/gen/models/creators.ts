/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  RemoveModelInputSchema,
  UpsertModelInputSchema,
} from "../schema/zod.js";
import type { RemoveModelInput, UpsertModelInput } from "../types.js";
import type { RemoveModelAction, UpsertModelAction } from "./actions.js";

export const upsertModel = (input: UpsertModelInput) =>
  createAction<UpsertModelAction>(
    "UPSERT_MODEL",
    { ...input },
    undefined,
    UpsertModelInputSchema,
    "global",
  );

export const removeModel = (input: RemoveModelInput) =>
  createAction<RemoveModelAction>(
    "REMOVE_MODEL",
    { ...input },
    undefined,
    RemoveModelInputSchema,
    "global",
  );
