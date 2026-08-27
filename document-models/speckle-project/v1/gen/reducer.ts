/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { Reducer, StateReducer } from "document-model";
import { createReducer, isDocumentAction } from "document-model";
import type { SpeckleProjectPHState } from "document-models/speckle-project/v1";

import { speckleProjectChangesOperations } from "../src/reducers/changes.js";
import { speckleProjectIdentityOperations } from "../src/reducers/identity.js";
import { speckleProjectModelsOperations } from "../src/reducers/models.js";
import { speckleProjectRevisionsOperations } from "../src/reducers/revisions.js";

import {
  ClearSyncedDataInputSchema,
  RecordChangeInputSchema,
  RemoveModelInputSchema,
  RemoveRevisionInputSchema,
  SetProjectIdentityInputSchema,
  UpsertModelInputSchema,
  UpsertRevisionInputSchema,
} from "./schema/zod.js";

const stateReducer: StateReducer<SpeckleProjectPHState> = (
  state,
  action,
  dispatch,
) => {
  if (isDocumentAction(action)) {
    return state;
  }
  switch (action.type) {
    case "SET_PROJECT_IDENTITY": {
      SetProjectIdentityInputSchema().parse(action.input);

      speckleProjectIdentityOperations.setProjectIdentityOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "CLEAR_SYNCED_DATA": {
      ClearSyncedDataInputSchema().parse(action.input);

      speckleProjectIdentityOperations.clearSyncedDataOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPSERT_MODEL": {
      UpsertModelInputSchema().parse(action.input);

      speckleProjectModelsOperations.upsertModelOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_MODEL": {
      RemoveModelInputSchema().parse(action.input);

      speckleProjectModelsOperations.removeModelOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "UPSERT_REVISION": {
      UpsertRevisionInputSchema().parse(action.input);

      speckleProjectRevisionsOperations.upsertRevisionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "REMOVE_REVISION": {
      RemoveRevisionInputSchema().parse(action.input);

      speckleProjectRevisionsOperations.removeRevisionOperation(
        (state as any)[action.scope],
        action as any,
        dispatch,
      );

      break;
    }

    case "RECORD_CHANGE": {
      RecordChangeInputSchema().parse(action.input);

      speckleProjectChangesOperations.recordChangeOperation(
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

export const reducer: Reducer<SpeckleProjectPHState> =
  createReducer(stateReducer);
