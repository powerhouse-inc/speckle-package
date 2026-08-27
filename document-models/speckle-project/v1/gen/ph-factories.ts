/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating SpeckleProjectDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  SpeckleProjectDocument,
  SpeckleProjectGlobalState,
  SpeckleProjectLocalState,
  SpeckleProjectPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): SpeckleProjectGlobalState {
  return {
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
}

export function defaultLocalState(): SpeckleProjectLocalState {
  return {};
}

export function defaultPHState(): SpeckleProjectPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<SpeckleProjectGlobalState>,
): SpeckleProjectGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<SpeckleProjectLocalState>,
): SpeckleProjectLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as SpeckleProjectLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<SpeckleProjectGlobalState>,
  localState?: Partial<SpeckleProjectLocalState>,
): SpeckleProjectPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a SpeckleProjectDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createSpeckleProjectDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<SpeckleProjectGlobalState>;
    local?: Partial<SpeckleProjectLocalState>;
  }>,
): SpeckleProjectDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
