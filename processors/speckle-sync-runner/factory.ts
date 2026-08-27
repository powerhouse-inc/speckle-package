import type {
  IProcessorHostModule,
  ProcessorApp,
  ProcessorFactoryBuilder,
  ProcessorFilter,
} from "@powerhousedao/reactor-browser";
import type { PHDocumentHeader } from "document-model";
import { SpeckleSyncRunner } from "./processor.js";

export const speckleSyncRunnerFactoryBuilder: ProcessorFactoryBuilder =
  (module: IProcessorHostModule) =>
  async (driveHeader: PHDocumentHeader, _processorApp?: ProcessorApp) => {
    const namespace = SpeckleSyncRunner.getNamespace(driveHeader.id);

    const store =
      await module.relationalDb.createNamespace<SpeckleSyncRunner>(namespace);

    // Only sync documents wake this runner; it writes to the project document
    // it is pointed at.
    const filter: ProcessorFilter = {
      branch: ["main"],
      documentId: ["*"],
      documentType: ["speckle/sync"],
      scope: ["global"],
    };

    const processor = new SpeckleSyncRunner(namespace, filter, store);

    // The scaffold's constructor takes no host module, but mirroring into
    // another document needs one, so hand the runner a narrow dispatch.
    processor.dispatchTo = (documentId, actions) =>
      module.dispatch.execute(documentId, driveHeader.branch, actions);

    // Nothing in the runtime calls this, so without it the first write hits a
    // database with no tables.
    await processor.initAndUpgrade();

    return [
      {
        processor,
        filter,
      },
    ];
  };
