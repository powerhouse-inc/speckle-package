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
import { speckleProjectUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsSpeckleProjectDocument,
  assertIsSpeckleProjectState,
  isSpeckleProjectDocument,
  isSpeckleProjectState,
} from "./document-schema.js";
import { speckleProjectDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  SpeckleProjectGlobalState,
  SpeckleProjectLocalState,
  SpeckleProjectPHState,
} from "./types.js";

export const initialGlobalState: SpeckleProjectGlobalState = {
  serverUrl: null,
  projectId: null,
  name: null,
  description: null,
  visibility: null,
  syncedAt: null,
  models: [],
  revisions: [],
  changes: [],
};
export const initialLocalState: SpeckleProjectLocalState = {};

export const utils: DocumentModelUtils<SpeckleProjectPHState> = {
  fileExtension: "sprj",
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
      speckleProjectDocumentType,
    );
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: speckleProjectUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isSpeckleProjectState(state);
  },
  assertIsStateOfType(state) {
    return assertIsSpeckleProjectState(state);
  },
  isDocumentOfType(document) {
    return isSpeckleProjectDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsSpeckleProjectDocument(document);
  },
};
