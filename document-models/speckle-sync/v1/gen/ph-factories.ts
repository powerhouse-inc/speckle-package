/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating SpeckleSyncDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  SpeckleSyncDocument,
  SpeckleSyncGlobalState,
  SpeckleSyncLocalState,
  SpeckleSyncPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): SpeckleSyncGlobalState {
  return {
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
}

export function defaultLocalState(): SpeckleSyncLocalState {
  return {
    accessToken: null,
    tokenLabel: null,
  };
}

export function defaultPHState(): SpeckleSyncPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<SpeckleSyncGlobalState>,
): SpeckleSyncGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<SpeckleSyncLocalState>,
): SpeckleSyncLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as SpeckleSyncLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<SpeckleSyncGlobalState>,
  localState?: Partial<SpeckleSyncLocalState>,
): SpeckleSyncPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a SpeckleSyncDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createSpeckleSyncDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<SpeckleSyncGlobalState>;
    local?: Partial<SpeckleSyncLocalState>;
  }>,
): SpeckleSyncDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
