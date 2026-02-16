# Logging

The extension uses two logging systems: **logger** for general extension logging and **DIAG** for API scraping diagnostics.

## Logger (`src/utils/logger.ts`)

All extension code (background, content scripts, popup) uses the `logger` utility instead of direct `console.*` calls. This keeps the console clean in production and routes errors to Sentry.

```typescript
import { logger } from "../utils/logger";

logger.log("informational message");   // DEBUG-gated — no output when DEBUG=false
logger.warn("warning message");        // DEBUG-gated
logger.error("something broke", err);  // Always prints, also sends to Sentry
```

- `log` / `warn`: Only output when the `DEBUG` flag in `logger.ts` is `true`. Set it to `false` for production builds to silence all informational console output.
- `error`: Always prints to console AND reports to Sentry. If any argument is an `Error` instance, it's sent via `captureException`; otherwise the stringified message is sent via `captureMessage`.
- **No direct `console.*` calls** exist in extension source outside of `logger.ts` and `sentry.ts`. This is enforced by convention.

## DIAG (`src/page-script.ts`)

The page script runs in TikTok's page context (not the extension context) to intercept fetch requests and make API calls. It has its own silent diagnostic logging system for debugging scraping issues.

DIAG logs are **silent by default** — nothing is printed to the console. Entries are collected in an in-memory array with timestamps.

### Tags

| Tag | What it logs |
|---|---|
| `intercept` | Every comment API fetch passing through the interceptor — source (`organic` vs `ours`), param count |
| `fetch` | Each top-level comment page request — cursor position |
| `fetch-reply` | Each reply page request — comment ID, cursor |
| `comment-api` | Raw response details — HTTP status, body length, content-type, body preview |
| `retry` | Retry attempts — attempt number, error message, backoff delay |
| `pagination` | Page-level progress — cursor, hasMore, counts |
| `api-start` | Scrape session start — whether tiktokFetch is native or SDK-patched |

### Accessing Logs

**From the browser console** (on the TikTok tab):

```javascript
// Copy all logs to clipboard
copy(window.__DIAG_LOGS.join("\n"))

// View the last 20 entries
window.__DIAG_LOGS.slice(-20)

// Filter by tag
window.__DIAG_LOGS.filter(l => l.includes("comment-api"))
```

**Download as a file:**

```javascript
document.dispatchEvent(new Event("tokative-dump-logs"))
```

This triggers a `diag-<timestamp>.log` file download containing all entries.

### Enabling Console Output

To temporarily print DIAG logs to the console during development, change the `diag` function in `page-script.ts`:

```typescript
function diag(tag: string, data: Record<string, unknown>): void {
  const entry = `[${new Date().toISOString()}][DIAG:${tag}] ${JSON.stringify(data)}`;
  diagLogs.push(entry);
  console.warn(`[DIAG:${tag}]`, JSON.stringify(data)); // add this line
}
```

## Sentry (`src/utils/sentry.ts`)

Error reporting is handled by Sentry via a standalone `BrowserClient` (no global SDK pollution). It's initialized per-context (background, content-tiktok, etc.) with `initSentry("context-name")`.

- Only `logger.error()` triggers Sentry reports.
- `TokativeError` subclasses include structured `code` and `context` fields that are sent as Sentry tags/contexts.
- Sentry is disabled when the DSN placeholder is empty (local dev without a DSN configured).
