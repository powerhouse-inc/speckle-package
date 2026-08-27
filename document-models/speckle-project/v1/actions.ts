/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  speckleProjectChangesActions,
  speckleProjectIdentityActions,
  speckleProjectModelsActions,
  speckleProjectRevisionsActions,
} from "./gen/creators.js";

/** Actions for the SpeckleProject document model */

export const actions = {
  ...baseActions,
  ...speckleProjectIdentityActions,
  ...speckleProjectModelsActions,
  ...speckleProjectRevisionsActions,
  ...speckleProjectChangesActions,
};
