/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { EditorModule } from "document-model";
import { lazy } from "react";

/** Document editor module for the "speckle/project" document type */
export const ModelExplorer: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["speckle/project"],
  config: {
    id: "model-explorer",
    name: "Model Explorer",
  },
};
