import {
  BrowserClient,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  Scope,
} from "@sentry/browser";
import type { SeverityLevel } from "@sentry/browser";
import { TokativeError } from "./errors";

declare const SENTRY_DSN_EXTENSION_PLACEHOLDER: string;
declare const TOKATIVE_ENDPOINT_PLACEHOLDER: string;

let client: BrowserClient | null = null;
let scope: Scope | null = null;

/** Initializes Sentry for the given extension context (background, content-tiktok, etc.). No-ops if DSN is empty. */
export function initSentry(context: string): void {
  const dsn = SENTRY_DSN_EXTENSION_PLACEHOLDER;
  if (!dsn || client) return;

  const isProduction = !TOKATIVE_ENDPOINT_PLACEHOLDER.includes("localhost");
  const version = chrome.runtime.getManifest().version;

  const integrations = getDefaultIntegrations({}).filter(
    (i) => !["BrowserApiErrors", "Breadcrumbs", "GlobalHandlers"].includes(i.name),
  );

  client = new BrowserClient({
    dsn,
    debug: true, // TODO: remove after verifying
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations,
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
  });

  scope = new Scope();
  scope.setClient(client);
  scope.setTag("extension_context", context);
  client.init();
}

export function captureException(error: unknown): void {
  if (!client || !scope) return;
  const eventId = client.captureException(error, undefined, scope);
  console.log("[Sentry] captureException sent, eventId:", eventId); // TODO: remove debug log
}

export function captureMessage(message: string, level: SeverityLevel = "error"): void {
  if (!client || !scope) return;
  client.captureMessage(message, level, undefined, scope);
}
