import type { SpeckleProjectChangesOperations } from "document-models/speckle-project/v1";
import {
  ChangeRevisionUnknownError,
  IncompleteChangeError,
} from "../../gen/changes/error.js";

export const speckleProjectChangesOperations: SpeckleProjectChangesOperations =
  {
    recordChangeOperation(state, action) {
      if (!action.input.toVersionId.trim()) {
        throw new IncompleteChangeError(
          "A change needs the revision it leads to",
        );
      }

      if (
        !state.revisions.some((r) => r.versionId === action.input.toVersionId)
      ) {
        throw new ChangeRevisionUnknownError(
          `Revision ${action.input.toVersionId} is not mirrored here`,
        );
      }

      const touched = (action.input.touchedElements || []).map((e) => ({
        id: e.id,
        identity: e.identity,
        objectId: e.objectId,
        speckleType: e.speckleType,
        kind: e.kind,
      }));

      // Counts are derived, never passed: they cannot then disagree with the list.
      const countOf = (kind: string) =>
        touched.filter((e) => e.kind === kind).length;

      const deltas = (action.input.deltas || []).map((d) => ({
        id: d.id,
        speckleType: d.speckleType,
        unit: d.unit || null,
        countBefore: d.countBefore,
        countAfter: d.countAfter,
        volumeBefore: d.volumeBefore ?? null,
        volumeAfter: d.volumeAfter ?? null,
        areaBefore: d.areaBefore ?? null,
        areaAfter: d.areaAfter ?? null,
      }));

      const existing = state.changes.find(
        (c) =>
          c.toVersionId === action.input.toVersionId &&
          c.speckleModelId === action.input.speckleModelId,
      );

      if (existing) {
        existing.fromVersionId = action.input.fromVersionId || null;
        existing.detectedAt = action.input.detectedAt;
        existing.touchedElements = touched;
        existing.addedCount = countOf("ADDED");
        existing.removedCount = countOf("REMOVED");
        existing.modifiedCount = countOf("MODIFIED");
        existing.deltas = deltas;
        return;
      }

      state.changes.unshift({
        id: action.input.id,
        speckleModelId: action.input.speckleModelId,
        fromVersionId: action.input.fromVersionId || null,
        toVersionId: action.input.toVersionId,
        detectedAt: action.input.detectedAt,
        touchedElements: touched,
        addedCount: countOf("ADDED"),
        removedCount: countOf("REMOVED"),
        modifiedCount: countOf("MODIFIED"),
        deltas: deltas,
      });
    },
  };
