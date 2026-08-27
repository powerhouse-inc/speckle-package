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
  SpeckleSyncAction,
  SpeckleSyncDocument,
} from "document-models/speckle-sync/v1";
import {
  assertIsSpeckleSyncDocument,
  isSpeckleSyncDocument,
} from "./gen/document-schema.js";

/** Hook to get a SpeckleSync document by its id */
export function useSpeckleSyncDocumentById(
  documentId: string | null | undefined,
):
  | [SpeckleSyncDocument, DocumentDispatch<SpeckleSyncAction>]
  | [undefined, undefined] {
  const [document, dispatch] = useDocumentById(documentId);
  if (!isSpeckleSyncDocument(document)) return [undefined, undefined];
  return [document, dispatch];
}

/** Hook to get the selected SpeckleSync document */
export function useSelectedSpeckleSyncDocument(): [
  SpeckleSyncDocument,
  DocumentDispatch<SpeckleSyncAction>,
] {
  const [document, dispatch] = useSelectedDocument();

  assertIsSpeckleSyncDocument(document);
  return [document, dispatch] as const;
}

/** Hook to get all SpeckleSync documents in the selected drive */
export function useSpeckleSyncDocumentsInSelectedDrive() {
  const documentsInSelectedDrive = useDocumentsInSelectedDrive();
  return documentsInSelectedDrive?.filter(isSpeckleSyncDocument);
}

/** Hook to get all SpeckleSync documents in the selected folder */
export function useSpeckleSyncDocumentsInSelectedFolder() {
  const documentsInSelectedFolder = useDocumentsInSelectedFolder();
  return documentsInSelectedFolder?.filter(isSpeckleSyncDocument);
}
