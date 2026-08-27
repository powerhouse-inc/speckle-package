export type ErrorCode = "IncompleteChangeError" | "ChangeRevisionUnknownError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class IncompleteChangeError extends Error implements ReducerError {
  errorCode = "IncompleteChangeError" as ErrorCode;
  constructor(message = "IncompleteChangeError") {
    super(message);
  }
}

export class ChangeRevisionUnknownError extends Error implements ReducerError {
  errorCode = "ChangeRevisionUnknownError" as ErrorCode;
  constructor(message = "ChangeRevisionUnknownError") {
    super(message);
  }
}

export const errors = {
  RecordChange: { IncompleteChangeError, ChangeRevisionUnknownError },
};
