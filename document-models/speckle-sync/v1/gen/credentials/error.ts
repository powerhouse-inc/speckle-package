export type ErrorCode = "EmptyAccessTokenError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class EmptyAccessTokenError extends Error implements ReducerError {
  errorCode = "EmptyAccessTokenError" as ErrorCode;
  constructor(message = "EmptyAccessTokenError") {
    super(message);
  }
}

export const errors = {
  SetAccessToken: { EmptyAccessTokenError },
};
