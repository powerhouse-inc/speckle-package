/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { SpeckleSyncAction } from "./actions.js";
import type {
  SpeckleSyncState as SpeckleSyncGlobalState,
  SpeckleSyncLocalState,
} from "./schema/types.js";

type SpeckleSyncPHState = PHBaseState & {
  global: SpeckleSyncGlobalState;
  local: SpeckleSyncLocalState;
};
type SpeckleSyncDocument = PHDocument<SpeckleSyncPHState>;

export * from "./schema/types.js";

export type {
  SpeckleSyncAction,
  SpeckleSyncDocument,
  SpeckleSyncGlobalState,
  SpeckleSyncLocalState,
  SpeckleSyncPHState,
};
