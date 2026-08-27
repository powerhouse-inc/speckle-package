export type ErrorCode =
  | "NotConfiguredError"
  | "SyncAlreadyRunningError"
  | "DuplicateRunError"
  | "RunNotFoundError"
  | "RunNotPendingError"
  | "RunNotRunningError"
  | "MissingFailureMessageError"
  | "RunAlreadyFinishedError"
  | "MissingCancelReasonError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class NotConfiguredError extends Error implements ReducerError {
  errorCode = "NotConfiguredError" as ErrorCode;
  constructor(message = "NotConfiguredError") {
    super(message);
  }
}

export class SyncAlreadyRunningError extends Error implements ReducerError {
  errorCode = "SyncAlreadyRunningError" as ErrorCode;
  constructor(message = "SyncAlreadyRunningError") {
    super(message);
  }
}

export class DuplicateRunError extends Error implements ReducerError {
  errorCode = "DuplicateRunError" as ErrorCode;
  constructor(message = "DuplicateRunError") {
    super(message);
  }
}

export class RunNotFoundError extends Error implements ReducerError {
  errorCode = "RunNotFoundError" as ErrorCode;
  constructor(message = "RunNotFoundError") {
    super(message);
  }
}

export class RunNotPendingError extends Error implements ReducerError {
  errorCode = "RunNotPendingError" as ErrorCode;
  constructor(message = "RunNotPendingError") {
    super(message);
  }
}

export class RunNotRunningError extends Error implements ReducerError {
  errorCode = "RunNotRunningError" as ErrorCode;
  constructor(message = "RunNotRunningError") {
    super(message);
  }
}

export class MissingFailureMessageError extends Error implements ReducerError {
  errorCode = "MissingFailureMessageError" as ErrorCode;
  constructor(message = "MissingFailureMessageError") {
    super(message);
  }
}

export class RunAlreadyFinishedError extends Error implements ReducerError {
  errorCode = "RunAlreadyFinishedError" as ErrorCode;
  constructor(message = "RunAlreadyFinishedError") {
    super(message);
  }
}

export class MissingCancelReasonError extends Error implements ReducerError {
  errorCode = "MissingCancelReasonError" as ErrorCode;
  constructor(message = "MissingCancelReasonError") {
    super(message);
  }
}

export const errors = {
  RequestSync: {
    NotConfiguredError,
    SyncAlreadyRunningError,
    DuplicateRunError,
  },

  StartRun: { RunNotFoundError, RunNotPendingError },

  CompleteRun: { RunNotRunningError },

  FailRun: { MissingFailureMessageError },

  CancelRun: { RunAlreadyFinishedError, MissingCancelReasonError },
};
