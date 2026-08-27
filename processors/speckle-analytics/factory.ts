import type {
  IProcessorHostModule,
  ProcessorApp,
  ProcessorFactoryBuilder,
  ProcessorFilter,
  ProcessorRecord,
} from "@powerhousedao/reactor-browser";
import { type PHDocumentHeader } from "document-model";
import { ANALYTICS_NAMESPACE_KEY, SpeckleAnalytics } from "./processor.js";

/**
 * Registers the analytics processor once for the whole reactor.
 *
 * The factory is called per drive, but this processor subscribes to every
 * `speckle/project` document and writes into a single analytics store. Letting
 * it register per drive would give two instances rebuilding the same document,
 * interleaving one instance's clear with the other's write — which shows up as
 * series counted twice over.
 */
export const speckleAnalyticsFactoryBuilder: ProcessorFactoryBuilder = (
  module: IProcessorHostModule,
) => {
  let registered: Promise<ProcessorRecord[]> | null = null;

  async function build(): Promise<ProcessorRecord[]> {
    const namespace = SpeckleAnalytics.getNamespace(ANALYTICS_NAMESPACE_KEY);

    const store =
      await module.relationalDb.createNamespace<SpeckleAnalytics>(namespace);

    const filter: ProcessorFilter = {
      branch: ["main"],
      documentId: ["*"],
      documentType: ["speckle/project"],
      scope: ["global"],
    };

    const processor = new SpeckleAnalytics(
      namespace,
      filter,
      store,
      module.analyticsStore,
    );

    await processor.initAndUpgrade();

    return [
      {
        processor,
        filter,
        // Without this the existing mirror history is never read, and the
        // charts stay empty until the next sync happens to touch a document.
        startFrom: "beginning",
      },
    ];
  }

  return async (_driveHeader: PHDocumentHeader, _processorApp?: ProcessorApp) => {
    if (registered) return [];

    registered = build();

    return registered;
  };
};
