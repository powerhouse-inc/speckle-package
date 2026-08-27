export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  Address: { input: `${string}:0x${string}`; output: `${string}:0x${string}` };
  Amount: {
    input: { unit?: string; value?: number };
    output: { unit?: string; value?: number };
  };
  Amount_Crypto: {
    input: { unit: string; value: string };
    output: { unit: string; value: string };
  };
  Amount_Currency: {
    input: { unit: string; value: string };
    output: { unit: string; value: string };
  };
  Amount_Fiat: {
    input: { unit: string; value: number };
    output: { unit: string; value: number };
  };
  Amount_Money: { input: number; output: number };
  Amount_Percentage: { input: number; output: number };
  Amount_Tokens: { input: number; output: number };
  AttachmentRef: {
    input: `attachment://v${number}:${string}`;
    output: `attachment://v${number}:${string}`;
  };
  Currency: { input: string; output: string };
  Date: { input: string; output: string };
  DateTime: { input: string; output: string };
  EmailAddress: { input: string; output: string };
  EthereumAddress: { input: string; output: string };
  OID: { input: string; output: string };
  OLabel: { input: string; output: string };
  PHID: { input: string; output: string };
  URL: { input: string; output: string };
  Unknown: { input: unknown; output: unknown };
  Upload: { input: File; output: File };
};

export type CategoryDelta = {
  areaAfter: Maybe<Scalars["Float"]["output"]>;
  areaBefore: Maybe<Scalars["Float"]["output"]>;
  countAfter: Scalars["Int"]["output"];
  countBefore: Scalars["Int"]["output"];
  id: Scalars["OID"]["output"];
  speckleType: Scalars["String"]["output"];
  unit: Maybe<Scalars["String"]["output"]>;
  volumeAfter: Maybe<Scalars["Float"]["output"]>;
  volumeBefore: Maybe<Scalars["Float"]["output"]>;
};

export type CategoryDeltaInput = {
  areaAfter?: InputMaybe<Scalars["Float"]["input"]>;
  areaBefore?: InputMaybe<Scalars["Float"]["input"]>;
  countAfter: Scalars["Int"]["input"];
  countBefore: Scalars["Int"]["input"];
  id: Scalars["OID"]["input"];
  speckleType: Scalars["String"]["input"];
  unit?: InputMaybe<Scalars["String"]["input"]>;
  volumeAfter?: InputMaybe<Scalars["Float"]["input"]>;
  volumeBefore?: InputMaybe<Scalars["Float"]["input"]>;
};

export type CategoryTotal = {
  area: Maybe<Scalars["Float"]["output"]>;
  id: Scalars["OID"]["output"];
  length: Maybe<Scalars["Float"]["output"]>;
  objectCount: Scalars["Int"]["output"];
  speckleType: Scalars["String"]["output"];
  unit: Maybe<Scalars["String"]["output"]>;
  volume: Maybe<Scalars["Float"]["output"]>;
};

export type CategoryTotalInput = {
  area?: InputMaybe<Scalars["Float"]["input"]>;
  id: Scalars["OID"]["input"];
  length?: InputMaybe<Scalars["Float"]["input"]>;
  objectCount: Scalars["Int"]["input"];
  speckleType: Scalars["String"]["input"];
  unit?: InputMaybe<Scalars["String"]["input"]>;
  volume?: InputMaybe<Scalars["Float"]["input"]>;
};

export type ChangeEntry = {
  addedCount: Scalars["Int"]["output"];
  deltas: Array<CategoryDelta>;
  detectedAt: Scalars["DateTime"]["output"];
  fromVersionId: Maybe<Scalars["String"]["output"]>;
  id: Scalars["OID"]["output"];
  modifiedCount: Scalars["Int"]["output"];
  removedCount: Scalars["Int"]["output"];
  speckleModelId: Scalars["String"]["output"];
  toVersionId: Scalars["String"]["output"];
  touchedElements: Array<TouchedElement>;
};

export type ChangeKind = "ADDED" | "MODIFIED" | "REMOVED";

export type ClearSyncedDataInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type RecordChangeInput = {
  deltas?: InputMaybe<Array<CategoryDeltaInput>>;
  detectedAt: Scalars["DateTime"]["input"];
  fromVersionId?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  speckleModelId: Scalars["String"]["input"];
  toVersionId: Scalars["String"]["input"];
  touchedElements?: InputMaybe<Array<TouchedElementInput>>;
};

export type RemoveModelInput = {
  speckleModelId: Scalars["String"]["input"];
};

export type RemoveRevisionInput = {
  versionId: Scalars["String"]["input"];
};

export type Revision = {
  authorName: Maybe<Scalars["String"]["output"]>;
  categories: Array<CategoryTotal>;
  createdAt: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["OID"]["output"];
  message: Maybe<Scalars["String"]["output"]>;
  modelName: Maybe<Scalars["String"]["output"]>;
  objectCount: Scalars["Int"]["output"];
  previewUrl: Maybe<Scalars["URL"]["output"]>;
  referencedObject: Scalars["String"]["output"];
  sourceApplication: Maybe<Scalars["String"]["output"]>;
  speckleModelId: Scalars["String"]["output"];
  syncedAt: Scalars["DateTime"]["output"];
  truncated: Scalars["Boolean"]["output"];
  versionId: Scalars["String"]["output"];
};

export type SetProjectIdentityInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  projectId: Scalars["String"]["input"];
  serverUrl: Scalars["URL"]["input"];
  syncedAt: Scalars["DateTime"]["input"];
  visibility?: InputMaybe<Scalars["String"]["input"]>;
};

export type SpeckleModel = {
  displayName: Maybe<Scalars["String"]["output"]>;
  id: Scalars["OID"]["output"];
  latestVersionId: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  speckleModelId: Scalars["String"]["output"];
  updatedAt: Maybe<Scalars["DateTime"]["output"]>;
  versionCount: Scalars["Int"]["output"];
};

export type SpeckleProjectState = {
  changes: Array<ChangeEntry>;
  description: Maybe<Scalars["String"]["output"]>;
  models: Array<SpeckleModel>;
  name: Maybe<Scalars["String"]["output"]>;
  projectId: Maybe<Scalars["String"]["output"]>;
  revisions: Array<Revision>;
  serverUrl: Maybe<Scalars["URL"]["output"]>;
  syncedAt: Maybe<Scalars["DateTime"]["output"]>;
  visibility: Maybe<Scalars["String"]["output"]>;
};

/**
 * One element a revision touched, carrying the identity that survives edits.
 *
 * A Speckle object id is a content hash, so it changes whenever the element does.
 * `identity` is the authoring tool's own element id where it has one, which is what
 * makes it possible to say that the same wall was modified in four revisions.
 */
export type TouchedElement = {
  id: Scalars["OID"]["output"];
  identity: Scalars["String"]["output"];
  kind: ChangeKind;
  objectId: Scalars["String"]["output"];
  speckleType: Scalars["String"]["output"];
};

export type TouchedElementInput = {
  id: Scalars["OID"]["input"];
  identity: Scalars["String"]["input"];
  kind: ChangeKind;
  objectId: Scalars["String"]["input"];
  speckleType: Scalars["String"]["input"];
};

export type UpsertModelInput = {
  displayName?: InputMaybe<Scalars["String"]["input"]>;
  id: Scalars["OID"]["input"];
  latestVersionId?: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  speckleModelId: Scalars["String"]["input"];
  updatedAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  versionCount: Scalars["Int"]["input"];
};

export type UpsertRevisionInput = {
  authorName?: InputMaybe<Scalars["String"]["input"]>;
  categories: Array<CategoryTotalInput>;
  createdAt?: InputMaybe<Scalars["DateTime"]["input"]>;
  id: Scalars["OID"]["input"];
  message?: InputMaybe<Scalars["String"]["input"]>;
  modelName?: InputMaybe<Scalars["String"]["input"]>;
  objectCount: Scalars["Int"]["input"];
  previewUrl?: InputMaybe<Scalars["URL"]["input"]>;
  referencedObject: Scalars["String"]["input"];
  sourceApplication?: InputMaybe<Scalars["String"]["input"]>;
  speckleModelId: Scalars["String"]["input"];
  syncedAt: Scalars["DateTime"]["input"];
  truncated?: InputMaybe<Scalars["Boolean"]["input"]>;
  versionId: Scalars["String"]["input"];
};
