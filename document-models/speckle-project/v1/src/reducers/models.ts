import type { SpeckleProjectModelsOperations } from "document-models/speckle-project/v1";
import {
  InvalidModelIdError,
  ModelNotFoundError,
} from "../../gen/models/error.js";

export const speckleProjectModelsOperations: SpeckleProjectModelsOperations = {
  upsertModelOperation(state, action) {
    if (!action.input.speckleModelId.trim()) {
      throw new InvalidModelIdError("A Speckle model id is required");
    }

    const existing = state.models.find(
      (m) => m.speckleModelId === action.input.speckleModelId,
    );

    if (existing) {
      existing.name = action.input.name;
      existing.displayName = action.input.displayName || null;
      existing.updatedAt = action.input.updatedAt || null;
      existing.latestVersionId = action.input.latestVersionId || null;
      existing.versionCount = action.input.versionCount;
      return;
    }

    state.models.push({
      id: action.input.id,
      speckleModelId: action.input.speckleModelId,
      name: action.input.name,
      displayName: action.input.displayName || null,
      updatedAt: action.input.updatedAt || null,
      latestVersionId: action.input.latestVersionId || null,
      versionCount: action.input.versionCount,
    });
  },
  removeModelOperation(state, action) {
    const index = state.models.findIndex(
      (m) => m.speckleModelId === action.input.speckleModelId,
    );

    if (index === -1) {
      throw new ModelNotFoundError(
        `Model ${action.input.speckleModelId} is not mirrored here`,
      );
    }

    state.models.splice(index, 1);
    state.revisions = state.revisions.filter(
      (r) => r.speckleModelId !== action.input.speckleModelId,
    );
    state.changes = state.changes.filter(
      (c) => c.speckleModelId !== action.input.speckleModelId,
    );
  },
};
