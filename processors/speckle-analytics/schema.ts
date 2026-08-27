/**
 * The element-granular read model.
 *
 * Everything else this processor produces lives in the analytics store. Element
 * hot spots do not, because ranking them — group by element, keep those touched
 * more than once, order by how often — is a query the analytics language cannot
 * express.
 */

export interface ElementTouchRow {
  project_document_id: string;
  identity: string;
  speckle_model_id: string;
  speckle_type: string;
  version_id: string;
  kind: string;
  object_id: string;
  detected_at: string;
}

export interface DB {
  element_touch: ElementTouchRow;
}
