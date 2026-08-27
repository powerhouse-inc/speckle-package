import type { SpeckleSyncCredentialsOperations } from "document-models/speckle-sync/v1";
import { EmptyAccessTokenError } from "../../gen/credentials/error.js";

export const speckleSyncCredentialsOperations: SpeckleSyncCredentialsOperations =
  {
    setAccessTokenOperation(state, action) {
      if (!action.input.accessToken.trim()) {
        throw new EmptyAccessTokenError("Access token must not be empty");
      }

      state.accessToken = action.input.accessToken;
      state.tokenLabel = action.input.tokenLabel || null;
    },
    clearAccessTokenOperation(state, _action) {
      state.accessToken = null;
      state.tokenLabel = null;
    },
  };
