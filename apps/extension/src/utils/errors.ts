export { TokativeError, AuthError } from "@tokative/shared";
export type { AuthErrorCode } from "@tokative/shared";
import { TokativeError } from "@tokative/shared";

export interface AddCommentsResult {
  new: number;
  preexisting: number;
  ignored: number;
}

export type TikTokApiErrorCode =
  | "TIKTOK_RATE_LIMITED"
  | "TIKTOK_API_HTTP_ERROR"
  | "TIKTOK_EMPTY_RESPONSE"
  | "TIKTOK_INVALID_JSON"
  | "TIKTOK_STATUS_ERROR"
  | "TIKTOK_NO_SIGNING_FN"
  | "TIKTOK_PARAMS_TIMEOUT";

export class TikTokApiError extends TokativeError {
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(
    code: TikTokApiErrorCode,
    message: string,
    { statusCode, retryable = false, ...rest }: { statusCode?: number; retryable?: boolean } & Record<string, unknown> = {},
  ) {
    super(code, message, { statusCode, retryable, ...rest });
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export type ScrapeSetupErrorCode =
  | "VIDEO_ID_NOT_FOUND"
  | "PAGE_SCRIPT_NOT_READY"
  | "COMMENTS_PANEL_FAILED"
  | "SCRAPE_CANCELLED";

export class ScrapeSetupError extends TokativeError {
  constructor(code: ScrapeSetupErrorCode, message: string, context: Record<string, unknown> = {}) {
    super(code, message, context);
  }
}

export type CommentReplyErrorCode =
  | "NO_COMMENTS_ON_VIDEO"
  | "COMMENT_NOT_FOUND"
  | "REPLY_BUTTON_NOT_FOUND"
  | "COMMENT_INPUT_NOT_FOUND"
  | "REPLY_TEXT_NOT_ENTERED"
  | "POST_BUTTON_NOT_FOUND"
  | "MENTION_BUTTON_NOT_FOUND"
  | "MENTION_DROPDOWN_NOT_FOUND"
  | "MENTION_NOT_INSERTED"
  | "MENTION_USER_NOT_FOUND";

export class CommentReplyError extends TokativeError {
  readonly commentId: string;

  constructor(
    code: CommentReplyErrorCode,
    message: string,
    { commentId, ...rest }: { commentId: string } & Record<string, unknown>,
  ) {
    super(code, message, { commentId, ...rest });
    this.commentId = commentId;
  }
}

export type TabErrorCode =
  | "TAB_CREATE_FAILED"
  | "TAB_LOAD_TIMEOUT"
  | "CONTENT_SCRIPT_UNRESPONSIVE"
  | "REPLY_TIMEOUT"
  | "NO_VIDEO_URL"
  | "BATCH_CANCELLED";

export class TabError extends TokativeError {
  readonly tabId?: number;

  constructor(code: TabErrorCode, message: string, { tabId, ...rest }: { tabId?: number } & Record<string, unknown> = {}) {
    super(code, message, { tabId, ...rest });
    this.tabId = tabId;
  }
}

export class CommentLimitError extends TokativeError {
  readonly monthlyLimit: number;
  readonly currentCount: number;
  readonly plan: string;
  readonly partialResult: AddCommentsResult;

  constructor(monthlyLimit: number, currentCount: number, plan: string, partialResult: AddCommentsResult) {
    super("COMMENT_LIMIT_REACHED", `Monthly comment limit reached (${currentCount}/${monthlyLimit})`, {
      monthlyLimit, currentCount, plan,
    });
    this.monthlyLimit = monthlyLimit;
    this.currentCount = currentCount;
    this.plan = plan;
    this.partialResult = partialResult;
  }
}

/** Maps serialized error strings from page-script.ts (which can't import extension modules) to typed errors. */
export function fromPageScriptError(message: string): TokativeError {
  if (message.includes("Rate limited")) {
    return new TikTokApiError("TIKTOK_RATE_LIMITED", message, { statusCode: 429, retryable: true });
  }
  if (message.startsWith("API error:")) {
    const statusCode = parseInt(message.match(/API error: (\d+)/)?.[1] ?? "", 10) || undefined;
    return new TikTokApiError("TIKTOK_API_HTTP_ERROR", message, { statusCode, retryable: statusCode === 429 });
  }
  if (message.includes("Empty response body")) {
    const statusCode = parseInt(message.match(/status (\d+)/)?.[1] ?? "", 10) || undefined;
    return new TikTokApiError("TIKTOK_EMPTY_RESPONSE", message, { statusCode, retryable: true });
  }
  if (message.includes("Invalid JSON")) {
    const statusCode = parseInt(message.match(/status (\d+)/)?.[1] ?? "", 10) || undefined;
    return new TikTokApiError("TIKTOK_INVALID_JSON", message, { statusCode, retryable: true });
  }
  if (message.startsWith("TikTok status:")) {
    return new TikTokApiError("TIKTOK_STATUS_ERROR", message, { retryable: false });
  }
  if (message.includes("Signing function not found") || message === "No signing function") {
    return new TikTokApiError("TIKTOK_NO_SIGNING_FN", message, { retryable: false });
  }
  if (message.includes("Could not capture API params")) {
    return new TikTokApiError("TIKTOK_PARAMS_TIMEOUT", message, { retryable: false });
  }
  if (message.includes("Could not determine video ID")) {
    return new ScrapeSetupError("VIDEO_ID_NOT_FOUND", message);
  }
  if (message === "Cancelled") {
    return new ScrapeSetupError("SCRAPE_CANCELLED", message);
  }
  return new TikTokApiError("TIKTOK_API_HTTP_ERROR", message, { retryable: false });
}
