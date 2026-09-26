import { gql } from "graphql-tag";
import type { DocumentNode } from "graphql";

export const schema: DocumentNode = gql`
  """
  The Speckle server this reactor is paired with, as a browser should reach it.

  Only the public origin is published. The service token and the in-cluster
  address stay on the server: the first is a credential and the second is
  meaningless outside the cluster.
  """
  type SpeckleServerInfo {
    """
    The browser-facing origin, e.g. https://acme-speckle.vetra.io — null when
    this reactor has no Speckle server configured.
    """
    publicOrigin: String
  }

  type Query {
    speckleServer: SpeckleServerInfo!
  }
`;
