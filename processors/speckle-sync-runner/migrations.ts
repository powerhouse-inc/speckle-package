import type { IRelationalDb } from "@powerhousedao/reactor-browser";

export async function up(db: IRelationalDb<any>): Promise<void> {
  await db.schema
    .createTable("synced_version")
    .addColumn("sync_document_id", "varchar(255)")
    .addColumn("speckle_model_id", "varchar(255)")
    .addColumn("version_id", "varchar(255)")
    .addColumn("referenced_object", "varchar(255)")
    .addColumn("object_count", "integer")
    .addColumn("synced_at", "varchar(64)")
    .addPrimaryKeyConstraint("synced_version_pkey", [
      "sync_document_id",
      "version_id",
    ])
    .ifNotExists()
    .execute();
}

export async function down(db: IRelationalDb<any>): Promise<void> {
  await db.schema.dropTable("synced_version").ifExists().execute();
}
