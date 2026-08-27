/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  CancelRunInputSchema,
  CompleteRunInputSchema,
  FailRunInputSchema,
  RequestSyncInputSchema,
  StartRunInputSchema,
} from "../schema/zod.js";
import type {
  CancelRunInput,
  CompleteRunInput,
  FailRunInput,
  RequestSyncInput,
  StartRunInput,
} from "../types.js";
import type {
  CancelRunAction,
  CompleteRunAction,
  FailRunAction,
  RequestSyncAction,
  StartRunAction,
} from "./actions.js";

export const requestSync = (input: RequestSyncInput) =>
  createAction<RequestSyncAction>(
    "REQUEST_SYNC",
    { ...input },
    undefined,
    RequestSyncInputSchema,
    "global",
  );

export const startRun = (input: StartRunInput) =>
  createAction<StartRunAction>(
    "START_RUN",
    { ...input },
    undefined,
    StartRunInputSchema,
    "global",
  );

export const completeRun = (input: CompleteRunInput) =>
  createAction<CompleteRunAction>(
    "COMPLETE_RUN",
    { ...input },
    undefined,
    CompleteRunInputSchema,
    "global",
  );

export const failRun = (input: FailRunInput) =>
  createAction<FailRunAction>(
    "FAIL_RUN",
    { ...input },
    undefined,
    FailRunInputSchema,
    "global",
  );

export const cancelRun = (input: CancelRunInput) =>
  createAction<CancelRunAction>(
    "CANCEL_RUN",
    { ...input },
    undefined,
    CancelRunInputSchema,
    "global",
  );
