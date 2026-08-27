/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { SpeckleSyncPHState } from "document-models/speckle-sync/v1";

import { speckleSyncConnectionOperations } from "../src/reducers/connection.js";
import { speckleSyncCredentialsOperations } from "../src/reducers/credentials.js";
import { speckleSyncRunsOperations } from "../src/reducers/runs.js";

import {
  CancelRunInputSchema,
  ClearAccessTokenInputSchema,
  CompleteRunInputSchema,
  FailRunInputSchema,
  RequestSyncInputSchema,
  SetAccessTokenInputSchema,
  SetServerConnectionInputSchema,
  SetSyncOptionsInputSchema,
  SetTargetProjectDocumentInputSchema,
  StartRunInputSchema,
} from "./schema/zod.js";

const stateReducer: StateReducer<SpeckleSyncPHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_SERVER_CONNECTION": {
      SetServerConnectionInputSchema().parse(action.input);

      speckleSyncConnectionOperations.setServerConnectionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_TARGET_PROJECT_DOCUMENT": {
      SetTargetProjectDocumentInputSchema().parse(action.input);

      speckleSyncConnectionOperations.setTargetProjectDocumentOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_SYNC_OPTIONS": {
      SetSyncOptionsInputSchema().parse(action.input);

      speckleSyncConnectionOperations.setSyncOptionsOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "SET_ACCESS_TOKEN": {
      SetAccessTokenInputSchema().parse(action.input);

      speckleSyncCredentialsOperations.setAccessTokenOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CLEAR_ACCESS_TOKEN": {
      ClearAccessTokenInputSchema().parse(action.input);

      speckleSyncCredentialsOperations.clearAccessTokenOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REQUEST_SYNC": {
      RequestSyncInputSchema().parse(action.input);

      speckleSyncRunsOperations.requestSyncOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "START_RUN": {
      StartRunInputSchema().parse(action.input);

      speckleSyncRunsOperations.startRunOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "COMPLETE_RUN": {
      CompleteRunInputSchema().parse(action.input);

      speckleSyncRunsOperations.completeRunOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "FAIL_RUN": {
      FailRunInputSchema().parse(action.input);

      speckleSyncRunsOperations.failRunOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CANCEL_RUN": {
      CancelRunInputSchema().parse(action.input);

      speckleSyncRunsOperations.cancelRunOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    default:
      return state;
  }
};

export const reducer: Reducer<SpeckleSyncPHState> = createReducer(stateReducer);
