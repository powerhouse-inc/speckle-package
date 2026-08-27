/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  ClearAccessTokenInputSchema,
  SetAccessTokenInputSchema,
} from "../schema/zod.js";
import type { ClearAccessTokenInput, SetAccessTokenInput } from "../types.js";
import type {
  ClearAccessTokenAction,
  SetAccessTokenAction,
} from "./actions.js";

export const setAccessToken = (input: SetAccessTokenInput) =>
  createAction<SetAccessTokenAction>(
    "SET_ACCESS_TOKEN",
    { ...input },
    undefined,
    SetAccessTokenInputSchema,
    "local",
  );

export const clearAccessToken = (input: ClearAccessTokenInput) =>
  createAction<ClearAccessTokenAction>(
    "CLEAR_ACCESS_TOKEN",
    { ...input },
    undefined,
    ClearAccessTokenInputSchema,
    "local",
  );
