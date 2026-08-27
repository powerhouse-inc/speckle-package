import type { EditorModule } from "document-model";
import { lazy } from "react";

/**
 * Drive app for drives holding Speckle mirrors.
 *
 * Registered against the drive document type, so Connect offers it in place of
 * the generic file explorer.
 */
export const SpeckleWorkspace: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["powerhouse/document-drive"],
  config: {
    id: "speckle-workspace",
    name: "Speckle Workspace",
  },
};
