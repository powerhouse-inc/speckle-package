/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { RecordChangeInputSchema } from "../schema/zod.js";
import type { RecordChangeInput } from "../types.js";
import type { RecordChangeAction } from "./actions.js";

export const recordChange = (input: RecordChangeInput) =>
  createAction<RecordChangeAction>(
    "RECORD_CHANGE",
    { ...input },
    undefined,
    RecordChangeInputSchema,
    "global",
  );
