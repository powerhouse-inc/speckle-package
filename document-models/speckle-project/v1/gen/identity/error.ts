export type ErrorCode = "MissingProjectIdentityError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class MissingProjectIdentityError extends Error implements ReducerError {
  errorCode = "MissingProjectIdentityError" as ErrorCode;
  constructor(message = "MissingProjectIdentityError") {
    super(message);
  }
}

export const errors = {
  SetProjectIdentity: { MissingProjectIdentityError },
};
