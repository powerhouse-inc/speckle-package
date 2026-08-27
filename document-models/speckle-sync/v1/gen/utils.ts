/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { DocumentModelUtils, PHBaseState, Reducer } from "document-model";
import {
  baseCreateDocument,
  baseLoadFromInputVersioned,
  baseSaveToFileHandle,
  createBaseState,
} from "document-model";
import { speckleSyncUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsSpeckleSyncDocument,
  assertIsSpeckleSyncState,
  isSpeckleSyncDocument,
  isSpeckleSyncState,
} from "./document-schema.js";
import { speckleSyncDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  SpeckleSyncGlobalState,
  SpeckleSyncLocalState,
  SpeckleSyncPHState,
} from "./types.js";

export const initialGlobalState: SpeckleSyncGlobalState = {
  serverUrl: null,
  projectId: null,
  projectName: null,
  targetProjectDocumentId: null,
  status: "IDLE",
  autoSync: false,
  versionsPerModel: 25,
  maxObjectsPerVersion: 5000,
  lastRequestedAt: null,
  lastCompletedAt: null,
  lastError: null,
  runs: [],
};
export const initialLocalState: SpeckleSyncLocalState = {
  accessToken: null,
  tokenLabel: null,
};

export const utils: DocumentModelUtils<SpeckleSyncPHState> = {
  fileExtension: "sync",
  createState(state) {
    return {
      ...createBaseState(state?.auth, { version: 1, ...state?.document }),
      global: { ...initialGlobalState, ...state?.global },
      local: { ...initialLocalState, ...state?.local },
    };
  },
  createDocument(state) {
    return baseCreateDocument(
      utils.createState,
      state,
      speckleSyncDocumentType,
    );
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: speckleSyncUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isSpeckleSyncState(state);
  },
  assertIsStateOfType(state) {
    return assertIsSpeckleSyncState(state);
  },
  isDocumentOfType(document) {
    return isSpeckleSyncDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsSpeckleSyncDocument(document);
  },
};
