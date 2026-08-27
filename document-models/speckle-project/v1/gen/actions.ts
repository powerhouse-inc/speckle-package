/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { SpeckleProjectChangesAction } from "./changes/actions.js";
import type { SpeckleProjectIdentityAction } from "./identity/actions.js";
import type { SpeckleProjectModelsAction } from "./models/actions.js";
import type { SpeckleProjectRevisionsAction } from "./revisions/actions.js";

export * from "./changes/actions.js";
export * from "./identity/actions.js";
export * from "./models/actions.js";
export * from "./revisions/actions.js";

export type SpeckleProjectAction =
  | SpeckleProjectIdentityAction
  | SpeckleProjectModelsAction
  | SpeckleProjectRevisionsAction
  | SpeckleProjectChangesAction;
