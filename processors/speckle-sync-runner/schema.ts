/**
 * The runner's own bookkeeping.
 *
 * The mirrored data lives in the Speckle Project document; this table only
 * records which versions have already been pulled, so a repeated sync does not
 * refetch object graphs it has already read.
 */

export interface SyncedVersionRow {
  sync_document_id: string;
  speckle_model_id: string;
  version_id: string;
  referenced_object: string;
  object_count: number;
  synced_at: string;
}

export interface DB {
  synced_version: SyncedVersionRow;
}
