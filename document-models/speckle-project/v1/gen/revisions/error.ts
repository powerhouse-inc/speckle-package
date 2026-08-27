export type ErrorCode =
  | "IncompleteRevisionError"
  | "UnknownRevisionModelError"
  | "RevisionNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class IncompleteRevisionError extends Error implements ReducerError {
  errorCode = "IncompleteRevisionError" as ErrorCode;
  constructor(message = "IncompleteRevisionError") {
    super(message);
  }
}

export class UnknownRevisionModelError extends Error implements ReducerError {
  errorCode = "UnknownRevisionModelError" as ErrorCode;
  constructor(message = "UnknownRevisionModelError") {
    super(message);
  }
}

export class RevisionNotFoundError extends Error implements ReducerError {
  errorCode = "RevisionNotFoundError" as ErrorCode;
  constructor(message = "RevisionNotFoundError") {
    super(message);
  }
}

export const errors = {
  UpsertRevision: { IncompleteRevisionError, UnknownRevisionModelError },

  RemoveRevision: { RevisionNotFoundError },
};
