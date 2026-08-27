/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { SpeckleSyncConnectionAction } from "./connection/actions.js";
import type { SpeckleSyncCredentialsAction } from "./credentials/actions.js";
import type { SpeckleSyncRunsAction } from "./runs/actions.js";

export * from "./connection/actions.js";
export * from "./credentials/actions.js";
export * from "./runs/actions.js";

export type SpeckleSyncAction =
  | SpeckleSyncConnectionAction
  | SpeckleSyncCredentialsAction
  | SpeckleSyncRunsAction;
