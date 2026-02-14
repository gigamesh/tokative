import * as Sentry from "@sentry/browser";
import { TokativeError } from "./errors";

declare const SENTRY_DSN_EXTENSION_PLACEHOLDER: string;
declare const TOKATIVE_ENDPOINT_PLACEHOLDER: string;

let initialized = false;

/** Initializes Sentry for the given extension context (background, content-tiktok, etc.). No-ops if DSN is empty. */
export function initSentry(context: string): void {
  const dsn = SENTRY_DSN_EXTENSION_PLACEHOLDER;
  if (!dsn || initialized) return;
  initialized = true;

  const isProduction = !TOKATIVE_ENDPOINT_PLACEHOLDER.includes("localhost");
  const version = chrome.runtime.getManifest().version;

  Sentry.init({
    dsn,
    environment: isProduction ? "production" : "development",
    release: `tokative-extension@${version}`,
    beforeSend(event, hint) {
      const error = hint?.originalException;
      if (error instanceof TokativeError) {
        event.tags = { ...event.tags, error_code: error.code };
        event.contexts = {
          ...event.contexts,
          tokative: error.context,
        };
      }
      return event;
    },
    initialScope: {
      tags: { extension_context: context },
    },
  });
}

export function captureException(error: unknown): void {
  Sentry.captureException(error);
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = "error"): void {
  Sentry.captureMessage(message, level);
}

export { Sentry };
