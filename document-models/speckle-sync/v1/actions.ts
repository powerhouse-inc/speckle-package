/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  speckleSyncConnectionActions,
  speckleSyncCredentialsActions,
  speckleSyncRunsActions,
} from "./gen/creators.js";

/** Actions for the SpeckleSync document model */

export const actions = {
  ...baseActions,
  ...speckleSyncConnectionActions,
  ...speckleSyncCredentialsActions,
  ...speckleSyncRunsActions,
};
