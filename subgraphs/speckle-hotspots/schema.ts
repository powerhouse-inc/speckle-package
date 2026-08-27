import { gql } from "graphql-tag";
import type { DocumentNode } from "graphql";

export const schema: DocumentNode = gql`
  """
  Elements that keep being touched.

  The analytics store cannot answer this: ranking by how often something changed
  needs a count, a threshold and an ordering by that count, and its query
  language has none of the three. So this reads the element-level table the
  Speckle Analytics processor maintains.
  """
  type SpeckleHotspot {
    """
    Stable element identity — the authoring tool's own id where it has one,
    which is what survives an edit changing the Speckle object hash.
    """
    identity: String!
    speckleType: String!
    speckleModelId: String!
    """Revisions that touched this element."""
    touches: Int!
    added: Int!
    modified: Int!
    removed: Int!
    firstDetectedAt: String!
    lastDetectedAt: String!
    """The most recent object id, so a viewer can isolate it."""
    objectId: String!
  }

  type SpeckleHotspotsQueries {
    """
    Elements of one mirrored project ranked by how many revisions touched them.
    """
    hotspots(
      projectDocumentId: String!
      minTouches: Int = 2
      limit: Int = 25
    ): [SpeckleHotspot!]!
  }

  type Query {
    speckleHotspots: SpeckleHotspotsQueries!
  }
`;
