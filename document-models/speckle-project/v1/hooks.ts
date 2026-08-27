/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { DocumentDispatch } from "@powerhousedao/reactor-browser";
import {
  useDocumentById,
  useDocumentsInSelectedDrive,
  useDocumentsInSelectedFolder,
  useSelectedDocument,
} from "@powerhousedao/reactor-browser";
import type {
  SpeckleProjectAction,
  SpeckleProjectDocument,
} from "document-models/speckle-project/v1";
import {
  assertIsSpeckleProjectDocument,
  isSpeckleProjectDocument,
} from "./gen/document-schema.js";

/** Hook to get a SpeckleProject document by its id */
export function useSpeckleProjectDocumentById(
  documentId: string | null | undefined,
):
  | [SpeckleProjectDocument, DocumentDispatch<SpeckleProjectAction>]
  | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isSpeckleProjectDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected SpeckleProject document */
export function useSelectedSpeckleProjectDocument(): [
  SpeckleProjectDocument,
  DocumentDispatch<SpeckleProjectAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsSpeckleProjectDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all SpeckleProject documents in the selected drive */
export function useSpeckleProjectDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isSpeckleProjectDocument);
}

/** Hook to get all SpeckleProject documents in the selected folder */
export function useSpeckleProjectDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isSpeckleProjectDocument);
}
