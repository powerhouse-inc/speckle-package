export type ErrorCode = "InvalidModelIdError" | "ModelNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidModelIdError extends Error implements ReducerError {
  errorCode = "InvalidModelIdError" as ErrorCode;
  constructor(message = "InvalidModelIdError") {
    super(message);
  }
}

export class ModelNotFoundError extends Error implements ReducerError {
  errorCode = "ModelNotFoundError" as ErrorCode;
  constructor(message = "ModelNotFoundError") {
    super(message);
  }
}

export const errors = {
  UpsertModel: { InvalidModelIdError },

  RemoveModel: { ModelNotFoundError },
};
