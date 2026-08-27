/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { ClearAccessTokenInput, SetAccessTokenInput } from "../types.js";

export type SetAccessTokenAction = Action & {
  type: "SET_ACCESS_TOKEN";
  input: SetAccessTokenInput;
};
export type ClearAccessTokenAction = Action & {
  type: "CLEAR_ACCESS_TOKEN";
  input: ClearAccessTokenInput;
};

export type SpeckleSyncCredentialsAction =
  | SetAccessTokenAction
  | ClearAccessTokenAction;
