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

export type CancelRunInput = {
  cancelledAt: Scalars["DateTime"]["input"];
  reason: Scalars["String"]["input"];
  runId: Scalars["OID"]["input"];
};

export type ClearAccessTokenInput = {
  _?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type CompleteRunInput = {
  finishedAt: Scalars["DateTime"]["input"];
  message?: InputMaybe<Scalars["String"]["input"]>;
  modelsSeen: Scalars["Int"]["input"];
  objectsScanned: Scalars["Int"]["input"];
  runId: Scalars["OID"]["input"];
  versionsAdded: Scalars["Int"]["input"];
  versionsSeen: Scalars["Int"]["input"];
};

export type FailRunInput = {
  finishedAt: Scalars["DateTime"]["input"];
  message: Scalars["String"]["input"];
  runId: Scalars["OID"]["input"];
};

export type RequestSyncInput = {
  fullResync?: InputMaybe<Scalars["Boolean"]["input"]>;
  id: Scalars["OID"]["input"];
  requestedAt: Scalars["DateTime"]["input"];
};

export type RunOutcome = "CANCELLED" | "FAILURE" | "PENDING" | "SUCCESS";

export type SetAccessTokenInput = {
  accessToken: Scalars["String"]["input"];
  tokenLabel?: InputMaybe<Scalars["String"]["input"]>;
};

export type SetServerConnectionInput = {
  projectId: Scalars["String"]["input"];
  projectName?: InputMaybe<Scalars["String"]["input"]>;
  serverUrl: Scalars["URL"]["input"];
};

export type SetSyncOptionsInput = {
  autoSync?: InputMaybe<Scalars["Boolean"]["input"]>;
  maxObjectsPerVersion?: InputMaybe<Scalars["Int"]["input"]>;
  versionsPerModel?: InputMaybe<Scalars["Int"]["input"]>;
};

export type SetTargetProjectDocumentInput = {
  targetProjectDocumentId: Scalars["PHID"]["input"];
};

export type SpeckleSyncLocalState = {
  accessToken: Maybe<Scalars["String"]["output"]>;
  tokenLabel: Maybe<Scalars["String"]["output"]>;
};

export type SpeckleSyncState = {
  autoSync: Scalars["Boolean"]["output"];
  lastCompletedAt: Maybe<Scalars["DateTime"]["output"]>;
  lastError: Maybe<Scalars["String"]["output"]>;
  lastRequestedAt: Maybe<Scalars["DateTime"]["output"]>;
  maxObjectsPerVersion: Scalars["Int"]["output"];
  projectId: Maybe<Scalars["String"]["output"]>;
  projectName: Maybe<Scalars["String"]["output"]>;
  runs: Array<SyncRun>;
  serverUrl: Maybe<Scalars["URL"]["output"]>;
  status: SyncStatus;
  targetProjectDocumentId: Maybe<Scalars["PHID"]["output"]>;
  versionsPerModel: Scalars["Int"]["output"];
};

export type StartRunInput = {
  runId: Scalars["OID"]["input"];
  startedAt: Scalars["DateTime"]["input"];
};

export type SyncRun = {
  finishedAt: Maybe<Scalars["DateTime"]["output"]>;
  fullResync: Scalars["Boolean"]["output"];
  id: Scalars["OID"]["output"];
  message: Maybe<Scalars["String"]["output"]>;
  modelsSeen: Scalars["Int"]["output"];
  objectsScanned: Scalars["Int"]["output"];
  outcome: RunOutcome;
  requestedAt: Scalars["DateTime"]["output"];
  startedAt: Maybe<Scalars["DateTime"]["output"]>;
  versionsAdded: Scalars["Int"]["output"];
  versionsSeen: Scalars["Int"]["output"];
};

export type SyncStatus = "FAILED" | "IDLE" | "REQUESTED" | "RUNNING";
