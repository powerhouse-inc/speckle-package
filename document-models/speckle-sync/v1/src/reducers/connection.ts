import type { SpeckleSyncConnectionOperations } from "document-models/speckle-sync/v1";
import {
  InvalidSyncOptionError,
  MissingProjectIdError,
} from "../../gen/connection/error.js";

export const speckleSyncConnectionOperations: SpeckleSyncConnectionOperations =
  {
    setServerConnectionOperation(state, action) {
      if (!action.input.projectId.trim()) {
        throw new MissingProjectIdError("A Speckle project id is required");
      }

      state.serverUrl = action.input.serverUrl;
      state.projectId = action.input.projectId;
      state.projectName = action.input.projectName || null;
    },
    setTargetProjectDocumentOperation(state, action) {
      state.targetProjectDocumentId = action.input.targetProjectDocumentId;
    },
    setSyncOptionsOperation(state, action) {
      if (
        action.input.autoSync !== undefined &&
        action.input.autoSync !== null
      ) {
        state.autoSync = action.input.autoSync;
      }

      if (
        action.input.versionsPerModel !== undefined &&
        action.input.versionsPerModel !== null
      ) {
        if (
          action.input.versionsPerModel < 1 ||
          action.input.versionsPerModel > 200
        ) {
          throw new InvalidSyncOptionError(
            "versionsPerModel must be between 1 and 200",
          );
        }

        state.versionsPerModel = action.input.versionsPerModel;
      }

      if (
        action.input.maxObjectsPerVersion !== undefined &&
        action.input.maxObjectsPerVersion !== null
      ) {
        if (
          action.input.maxObjectsPerVersion < 1 ||
          action.input.maxObjectsPerVersion > 100000
        ) {
          throw new InvalidSyncOptionError(
            "maxObjectsPerVersion must be between 1 and 100000",
          );
        }

        state.maxObjectsPerVersion = action.input.maxObjectsPerVersion;
      }
    },
  };
