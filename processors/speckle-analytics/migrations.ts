import type { IRelationalDb } from "@powerhousedao/reactor-browser";

export async function up(db: IRelationalDb<any>): Promise<void> {
  await db.schema
    .createTable("element_touch")
    .addColumn("project_document_id", "varchar(255)")
    .addColumn("identity", "varchar(512)")
    .addColumn("speckle_model_id", "varchar(255)")
    .addColumn("speckle_type", "varchar(255)")
    .addColumn("version_id", "varchar(255)")
    .addColumn("kind", "varchar(32)")
    .addColumn("object_id", "varchar(255)")
    .addColumn("detected_at", "varchar(64)")
    .addPrimaryKeyConstraint("element_touch_pkey", [
      "project_document_id",
      "identity",
      "version_id",
    ])
    .ifNotExists()
    .execute();

  // The hot-spot query groups by element within one document, so this is the
  // index that decides whether it is a scan or a seek.
  await db.schema
    .createIndex("element_touch_document_identity")
    .on("element_touch")
    .columns(["project_document_id", "identity"])
    .ifNotExists()
    .execute();
}

export async function down(db: IRelationalDb<any>): Promise<void> {
  await db.schema.dropTable("element_touch").ifExists().execute();
}
