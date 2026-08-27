/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { SpeckleProjectAction } from "./actions.js";
import type { SpeckleProjectState as SpeckleProjectGlobalState } from "./schema/types.js";

type SpeckleProjectLocalState = Record<PropertyKey, never>;

type SpeckleProjectPHState = PHBaseState & {
  global: SpeckleProjectGlobalState;
  local: SpeckleProjectLocalState;
};
type SpeckleProjectDocument = PHDocument<SpeckleProjectPHState>;

export * from "./schema/types.js";

export type {
  SpeckleProjectAction,
  SpeckleProjectDocument,
  SpeckleProjectGlobalState,
  SpeckleProjectLocalState,
  SpeckleProjectPHState,
};
