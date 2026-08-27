export type ErrorCode = "MissingProjectIdError" | "InvalidSyncOptionError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class MissingProjectIdError extends Error implements ReducerError {
  errorCode = "MissingProjectIdError" as ErrorCode;
  constructor(message = "MissingProjectIdError") {
    super(message);
  }
}

export class InvalidSyncOptionError extends Error implements ReducerError {
  errorCode = "InvalidSyncOptionError" as ErrorCode;
  constructor(message = "InvalidSyncOptionError") {
    super(message);
  }
}

export const errors = {
  SetServerConnection: { MissingProjectIdError },

  SetSyncOptions: { InvalidSyncOptionError },
};
