import { TokativeError } from "@tokative/shared";

export type ExtensionBridgeErrorCode =
  | "EXTENSION_NOT_FOUND"
  | "BRIDGE_TIMEOUT"
  | "BRIDGE_DISCONNECTED";

export class ExtensionBridgeError extends TokativeError {
  constructor(code: ExtensionBridgeErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(code, message, context);
  }
}

export type ConvexQueryErrorCode = "QUERY_FAILED" | "MUTATION_FAILED";

export class ConvexQueryError extends TokativeError {
  constructor(code: ConvexQueryErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(code, message, context);
  }
}

export type StripeErrorCode = "CHECKOUT_FAILED" | "PORTAL_FAILED";

export class StripeError extends TokativeError {
  constructor(code: StripeErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(code, message, context);
  }
}
