/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  CancelRunInput,
  ClearAccessTokenInput,
  CompleteRunInput,
  FailRunInput,
  RequestSyncInput,
  RunOutcome,
  SetAccessTokenInput,
  SetServerConnectionInput,
  SetSyncOptionsInput,
  SetTargetProjectDocumentInput,
  SpeckleSyncLocalState,
  SpeckleSyncState,
  StartRunInput,
  SyncRun,
  SyncStatus,
} from "./types.js";

type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>;
}>;

type definedNonNullAny = {};

export const isDefinedNonNullAny = (v: any): v is definedNonNullAny =>
  v !== undefined && v !== null;

export const definedNonNullAnySchema = z
  .any()
  .refine((v) => isDefinedNonNullAny(v));

export const RunOutcomeSchema = z.enum([
  "CANCELLED",
  "FAILURE",
  "PENDING",
  "SUCCESS",
]);

export const SyncStatusSchema = z.enum([
  "FAILED",
  "IDLE",
  "REQUESTED",
  "RUNNING",
]);

export function CancelRunInputSchema(): z.ZodObject<
  Properties<CancelRunInput>
> {
  return z.object({
    cancelledAt: z.iso.datetime(),
    reason: z.string(),
    runId: z.string(),
  });
}

export function ClearAccessTokenInputSchema(): z.ZodObject<
  Properties<ClearAccessTokenInput>
> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function CompleteRunInputSchema(): z.ZodObject<
  Properties<CompleteRunInput>
> {
  return z.object({
    finishedAt: z.iso.datetime(),
    message: z.string().nullish(),
    modelsSeen: z.number(),
    objectsScanned: z.number(),
    runId: z.string(),
    versionsAdded: z.number(),
    versionsSeen: z.number(),
  });
}

export function FailRunInputSchema(): z.ZodObject<Properties<FailRunInput>> {
  return z.object({
    finishedAt: z.iso.datetime(),
    message: z.string(),
    runId: z.string(),
  });
}

export function RequestSyncInputSchema(): z.ZodObject<
  Properties<RequestSyncInput>
> {
  return z.object({
    fullResync: z.boolean().nullish(),
    id: z.string(),
    requestedAt: z.iso.datetime(),
  });
}

export function SetAccessTokenInputSchema(): z.ZodObject<
  Properties<SetAccessTokenInput>
> {
  return z.object({
    accessToken: z.string(),
    tokenLabel: z.string().nullish(),
  });
}

export function SetServerConnectionInputSchema(): z.ZodObject<
  Properties<SetServerConnectionInput>
> {
  return z.object({
    projectId: z.string(),
    projectName: z.string().nullish(),
    serverUrl: z.url(),
  });
}

export function SetSyncOptionsInputSchema(): z.ZodObject<
  Properties<SetSyncOptionsInput>
> {
  return z.object({
    autoSync: z.boolean().nullish(),
    maxObjectsPerVersion: z.number().nullish(),
    versionsPerModel: z.number().nullish(),
  });
}

export function SetTargetProjectDocumentInputSchema(): z.ZodObject<
  Properties<SetTargetProjectDocumentInput>
> {
  return z.object({
    targetProjectDocumentId: z.string(),
  });
}

export function SpeckleSyncLocalStateSchema(): z.ZodObject<
  Properties<SpeckleSyncLocalState>
> {
  return z.object({
    __typename: z.literal("SpeckleSyncLocalState").optional(),
    accessToken: z.string().nullish(),
    tokenLabel: z.string().nullish(),
  });
}

export function SpeckleSyncStateSchema(): z.ZodObject<
  Properties<SpeckleSyncState>
> {
  return z.object({
    __typename: z.literal("SpeckleSyncState").optional(),
    autoSync: z.boolean(),
    lastCompletedAt: z.iso.datetime().nullish(),
    lastError: z.string().nullish(),
    lastRequestedAt: z.iso.datetime().nullish(),
    maxObjectsPerVersion: z.number(),
    projectId: z.string().nullish(),
    projectName: z.string().nullish(),
    runs: z.array(z.lazy(() => SyncRunSchema())),
    serverUrl: z.url().nullish(),
    status: SyncStatusSchema,
    targetProjectDocumentId: z.string().nullish(),
    versionsPerModel: z.number(),
  });
}

export function StartRunInputSchema(): z.ZodObject<Properties<StartRunInput>> {
  return z.object({
    runId: z.string(),
    startedAt: z.iso.datetime(),
  });
}

export function SyncRunSchema(): z.ZodObject<Properties<SyncRun>> {
  return z.object({
    __typename: z.literal("SyncRun").optional(),
    finishedAt: z.iso.datetime().nullish(),
    fullResync: z.boolean(),
    id: z.string(),
    message: z.string().nullish(),
    modelsSeen: z.number(),
    objectsScanned: z.number(),
    outcome: RunOutcomeSchema,
    requestedAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullish(),
    versionsAdded: z.number(),
    versionsSeen: z.number(),
  });
}
