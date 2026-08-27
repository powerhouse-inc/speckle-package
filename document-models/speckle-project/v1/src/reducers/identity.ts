import type { SpeckleProjectIdentityOperations } from "document-models/speckle-project/v1";
import { MissingProjectIdentityError } from "../../gen/identity/error.js";

export const speckleProjectIdentityOperations: SpeckleProjectIdentityOperations =
  {
    setProjectIdentityOperation(state, action) {
      if (!action.input.projectId.trim()) {
        throw new MissingProjectIdentityError(
          "A Speckle project id is required",
        );
      }

      state.serverUrl = action.input.serverUrl;
      state.projectId = action.input.projectId;
      state.name = action.input.name || null;
      state.description = action.input.description || null;
      state.visibility = action.input.visibility || null;
      state.syncedAt = action.input.syncedAt;
    },
    clearSyncedDataOperation(state, _action) {
      state.models = [];
      state.revisions = [];
      state.changes = [];
      state.syncedAt = null;
    },
  };
