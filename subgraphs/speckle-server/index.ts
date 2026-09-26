import { BaseSubgraph } from "@powerhousedao/reactor-api";
import type { DocumentNode } from "graphql";
import { getResolvers } from "./resolvers.js";
import { schema } from "./schema.js";

export class SpeckleServerSubgraph extends BaseSubgraph {
  name = "speckle-server";
  typeDefs: DocumentNode = schema;
  resolvers = getResolvers();
  additionalContextFields = {};
  async onSetup() {}
  async onDisconnect() {}
}
