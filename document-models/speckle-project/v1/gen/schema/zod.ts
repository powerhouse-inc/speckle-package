/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  CategoryDelta,
  CategoryDeltaInput,
  CategoryTotal,
  CategoryTotalInput,
  ChangeEntry,
  ChangeKind,
  ClearSyncedDataInput,
  RecordChangeInput,
  RemoveModelInput,
  RemoveRevisionInput,
  Revision,
  SetProjectIdentityInput,
  SpeckleModel,
  SpeckleProjectState,
  TouchedElement,
  TouchedElementInput,
  UpsertModelInput,
  UpsertRevisionInput,
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

export const ChangeKindSchema = z.enum(["ADDED", "MODIFIED", "REMOVED"]);

export function CategoryDeltaSchema(): z.ZodObject<Properties<CategoryDelta>> {
  return z.object({
    __typename: z.literal("CategoryDelta").optional(),
    areaAfter: z.number().nullish(),
    areaBefore: z.number().nullish(),
    countAfter: z.number(),
    countBefore: z.number(),
    id: z.string(),
    speckleType: z.string(),
    unit: z.string().nullish(),
    volumeAfter: z.number().nullish(),
    volumeBefore: z.number().nullish(),
  });
}

export function CategoryDeltaInputSchema(): z.ZodObject<
  Properties<CategoryDeltaInput>
> {
  return z.object({
    areaAfter: z.number().nullish(),
    areaBefore: z.number().nullish(),
    countAfter: z.number(),
    countBefore: z.number(),
    id: z.string(),
    speckleType: z.string(),
    unit: z.string().nullish(),
    volumeAfter: z.number().nullish(),
    volumeBefore: z.number().nullish(),
  });
}

export function CategoryTotalSchema(): z.ZodObject<Properties<CategoryTotal>> {
  return z.object({
    __typename: z.literal("CategoryTotal").optional(),
    area: z.number().nullish(),
    id: z.string(),
    length: z.number().nullish(),
    objectCount: z.number(),
    speckleType: z.string(),
    unit: z.string().nullish(),
    volume: z.number().nullish(),
  });
}

export function CategoryTotalInputSchema(): z.ZodObject<
  Properties<CategoryTotalInput>
> {
  return z.object({
    area: z.number().nullish(),
    id: z.string(),
    length: z.number().nullish(),
    objectCount: z.number(),
    speckleType: z.string(),
    unit: z.string().nullish(),
    volume: z.number().nullish(),
  });
}

export function ChangeEntrySchema(): z.ZodObject<Properties<ChangeEntry>> {
  return z.object({
    __typename: z.literal("ChangeEntry").optional(),
    addedCount: z.number(),
    deltas: z.array(z.lazy(() => CategoryDeltaSchema())),
    detectedAt: z.iso.datetime(),
    fromVersionId: z.string().nullish(),
    id: z.string(),
    modifiedCount: z.number(),
    removedCount: z.number(),
    speckleModelId: z.string(),
    toVersionId: z.string(),
    touchedElements: z.array(z.lazy(() => TouchedElementSchema())),
  });
}

export function ClearSyncedDataInputSchema(): z.ZodObject<
  Properties<ClearSyncedDataInput>
> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function RecordChangeInputSchema(): z.ZodObject<
  Properties<RecordChangeInput>
> {
  return z.object({
    deltas: z.array(z.lazy(() => CategoryDeltaInputSchema())).nullish(),
    detectedAt: z.iso.datetime(),
    fromVersionId: z.string().nullish(),
    id: z.string(),
    speckleModelId: z.string(),
    toVersionId: z.string(),
    touchedElements: z
      .array(z.lazy(() => TouchedElementInputSchema()))
      .nullish(),
  });
}

export function RemoveModelInputSchema(): z.ZodObject<
  Properties<RemoveModelInput>
> {
  return z.object({
    speckleModelId: z.string(),
  });
}

export function RemoveRevisionInputSchema(): z.ZodObject<
  Properties<RemoveRevisionInput>
> {
  return z.object({
    versionId: z.string(),
  });
}

export function RevisionSchema(): z.ZodObject<Properties<Revision>> {
  return z.object({
    __typename: z.literal("Revision").optional(),
    authorName: z.string().nullish(),
    categories: z.array(z.lazy(() => CategoryTotalSchema())),
    createdAt: z.iso.datetime().nullish(),
    id: z.string(),
    message: z.string().nullish(),
    modelName: z.string().nullish(),
    objectCount: z.number(),
    previewUrl: z.url().nullish(),
    referencedObject: z.string(),
    sourceApplication: z.string().nullish(),
    speckleModelId: z.string(),
    syncedAt: z.iso.datetime(),
    truncated: z.boolean(),
    versionId: z.string(),
  });
}

export function SetProjectIdentityInputSchema(): z.ZodObject<
  Properties<SetProjectIdentityInput>
> {
  return z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    projectId: z.string(),
    serverUrl: z.url(),
    syncedAt: z.iso.datetime(),
    visibility: z.string().nullish(),
  });
}

export function SpeckleModelSchema(): z.ZodObject<Properties<SpeckleModel>> {
  return z.object({
    __typename: z.literal("SpeckleModel").optional(),
    displayName: z.string().nullish(),
    id: z.string(),
    latestVersionId: z.string().nullish(),
    name: z.string(),
    speckleModelId: z.string(),
    updatedAt: z.iso.datetime().nullish(),
    versionCount: z.number(),
  });
}

export function SpeckleProjectStateSchema(): z.ZodObject<
  Properties<SpeckleProjectState>
> {
  return z.object({
    __typename: z.literal("SpeckleProjectState").optional(),
    changes: z.array(z.lazy(() => ChangeEntrySchema())),
    description: z.string().nullish(),
    models: z.array(z.lazy(() => SpeckleModelSchema())),
    name: z.string().nullish(),
    projectId: z.string().nullish(),
    revisions: z.array(z.lazy(() => RevisionSchema())),
    serverUrl: z.url().nullish(),
    syncedAt: z.iso.datetime().nullish(),
    visibility: z.string().nullish(),
  });
}

export function TouchedElementSchema(): z.ZodObject<
  Properties<TouchedElement>
> {
  return z.object({
    __typename: z.literal("TouchedElement").optional(),
    id: z.string(),
    identity: z.string(),
    kind: ChangeKindSchema,
    objectId: z.string(),
    speckleType: z.string(),
  });
}

export function TouchedElementInputSchema(): z.ZodObject<
  Properties<TouchedElementInput>
> {
  return z.object({
    id: z.string(),
    identity: z.string(),
    kind: ChangeKindSchema,
    objectId: z.string(),
    speckleType: z.string(),
  });
}

export function UpsertModelInputSchema(): z.ZodObject<
  Properties<UpsertModelInput>
> {
  return z.object({
    displayName: z.string().nullish(),
    id: z.string(),
    latestVersionId: z.string().nullish(),
    name: z.string(),
    speckleModelId: z.string(),
    updatedAt: z.iso.datetime().nullish(),
    versionCount: z.number(),
  });
}

export function UpsertRevisionInputSchema(): z.ZodObject<
  Properties<UpsertRevisionInput>
> {
  return z.object({
    authorName: z.string().nullish(),
    categories: z.array(z.lazy(() => CategoryTotalInputSchema())),
    createdAt: z.iso.datetime().nullish(),
    id: z.string(),
    message: z.string().nullish(),
    modelName: z.string().nullish(),
    objectCount: z.number(),
    previewUrl: z.url().nullish(),
    referencedObject: z.string(),
    sourceApplication: z.string().nullish(),
    speckleModelId: z.string(),
    syncedAt: z.iso.datetime(),
    truncated: z.boolean().nullish(),
    versionId: z.string(),
  });
}
