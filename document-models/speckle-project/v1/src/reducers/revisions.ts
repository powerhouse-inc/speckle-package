import type { SpeckleProjectRevisionsOperations } from "document-models/speckle-project/v1";
import {
  IncompleteRevisionError,
  RevisionNotFoundError,
  UnknownRevisionModelError,
} from "../../gen/revisions/error.js";

export const speckleProjectRevisionsOperations: SpeckleProjectRevisionsOperations =
  {
    upsertRevisionOperation(state, action) {
      if (
        !action.input.versionId.trim() ||
        !action.input.referencedObject.trim()
      ) {
        throw new IncompleteRevisionError(
          "Both versionId and referencedObject are required",
        );
      }

      if (
        !state.models.some(
          (m) => m.speckleModelId === action.input.speckleModelId,
        )
      ) {
        throw new UnknownRevisionModelError(
          `Model ${action.input.speckleModelId} must be mirrored before its revisions`,
        );
      }

      const categories = action.input.categories.map((c) => ({
        id: c.id,
        speckleType: c.speckleType,
        objectCount: c.objectCount,
        unit: c.unit || null,
        volume: c.volume ?? null,
        area: c.area ?? null,
        length: c.length ?? null,
      }));

      const existing = state.revisions.find(
        (r) => r.versionId === action.input.versionId,
      );

      if (existing) {
        existing.modelName = action.input.modelName || null;
        existing.referencedObject = action.input.referencedObject;
        existing.message = action.input.message || null;
        existing.sourceApplication = action.input.sourceApplication || null;
        existing.authorName = action.input.authorName || null;
        existing.createdAt = action.input.createdAt || null;
        existing.previewUrl = action.input.previewUrl || null;
        existing.objectCount = action.input.objectCount;
        existing.truncated = action.input.truncated ?? false;
        existing.categories = categories;
        existing.syncedAt = action.input.syncedAt;
      } else {
        state.revisions.push({
          id: action.input.id,
          speckleModelId: action.input.speckleModelId,
          modelName: action.input.modelName || null,
          versionId: action.input.versionId,
          referencedObject: action.input.referencedObject,
          message: action.input.message || null,
          sourceApplication: action.input.sourceApplication || null,
          authorName: action.input.authorName || null,
          createdAt: action.input.createdAt || null,
          previewUrl: action.input.previewUrl || null,
          objectCount: action.input.objectCount,
          truncated: action.input.truncated ?? false,
          categories: categories,
          syncedAt: action.input.syncedAt,
        });
      }

      // Newest first, with a stable tie-break so the order never depends on arrival.
      state.revisions.sort((a, b) => {
        const left = a.createdAt ?? "";
        const right = b.createdAt ?? "";

        if (left === right) return a.versionId.localeCompare(b.versionId);

        return right.localeCompare(left);
      });
    },
    removeRevisionOperation(state, action) {
      const index = state.revisions.findIndex(
        (r) => r.versionId === action.input.versionId,
      );

      if (index === -1) {
        throw new RevisionNotFoundError(
          `Revision ${action.input.versionId} is not mirrored here`,
        );
      }

      state.revisions.splice(index, 1);
      state.changes = state.changes.filter(
        (c) =>
          c.toVersionId !== action.input.versionId &&
          c.fromVersionId !== action.input.versionId,
      );
    },
  };
