import { type BaseSubgraph } from "@powerhousedao/reactor-api";
import {
  ANALYTICS_NAMESPACE_KEY,
  SpeckleAnalytics,
} from "processors/speckle-analytics";
import { foldHotspots, type TouchGroup } from "./lib.js";

interface HotspotArgs {
  projectDocumentId: string;
  minTouches?: number | null;
  limit?: number | null;
}

export const getResolvers = (
  subgraph: BaseSubgraph,
): Record<string, unknown> => {
  return {
    Query: {
      speckleHotspots: () => ({}), // namespace resolver for nested queries
    },
    SpeckleHotspotsQueries: {
      hotspots: async (parent: unknown, args: HotspotArgs) => {
        const namespace = SpeckleAnalytics.getNamespace(ANALYTICS_NAMESPACE_KEY);

        const db = await subgraph.relationalDb.createNamespace<{
          element_touch: {
            project_document_id: string;
            identity: string;
            speckle_model_id: string;
            speckle_type: string;
            version_id: string;
            kind: string;
            object_id: string;
            detected_at: string;
          };
        }>(namespace);

        // Grouping is the expensive part, so it happens in the database; the
        // fold into one row per element is pure and lives in lib.
        const rows = await db
          .selectFrom("element_touch")
          .select((eb) => [
            "identity",
            "kind",
            eb.fn.count<number>("version_id").as("touches"),
            eb.fn.max("speckle_type").as("speckleType"),
            eb.fn.max("speckle_model_id").as("speckleModelId"),
            eb.fn.min("detected_at").as("firstDetectedAt"),
            eb.fn.max("detected_at").as("lastDetectedAt"),
            eb.fn.max("object_id").as("objectId"),
          ])
          .where("project_document_id", "=", args.projectDocumentId)
          .groupBy(["identity", "kind"])
          .execute();

        // Every group holds at least one row, so the aggregates are present;
        // only the count needs coercing, since drivers may return it as text.
        const groups: TouchGroup[] = rows.map((row) => ({
          identity: row.identity,
          kind: row.kind,
          touches: Number(row.touches),
          speckleType: row.speckleType,
          speckleModelId: row.speckleModelId,
          firstDetectedAt: row.firstDetectedAt,
          lastDetectedAt: row.lastDetectedAt,
          objectId: row.objectId,
        }));

        return foldHotspots(groups, args.minTouches ?? 2, args.limit ?? 25);
      },
    },
  };
};
