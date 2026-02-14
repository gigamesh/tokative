/** Base error class for all Tokative errors. Provides a stable `code` for Sentry grouping and structured `context` for debugging. */
export class TokativeError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;

  constructor(code: string, message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
  }
}

export type AuthErrorCode = "NOT_AUTHENTICATED" | "API_HTTP_ERROR";

export class AuthError extends TokativeError {
  readonly httpStatus?: number;

  constructor(code: AuthErrorCode, message: string, { httpStatus, ...rest }: { httpStatus?: number } & Record<string, unknown> = {}) {
    super(code, message, { httpStatus, ...rest });
    this.httpStatus = httpStatus;
  }
}
