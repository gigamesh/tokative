# Resilience improvements for API comment scraping

## Context

The bug we just fixed: `capturedCommentParams` was reset to `null` right before `waitForCapturedParams()` polled for them. This worked before because TikTok used to make additional `/api/comment/list/` polling calls within the 15s window. When TikTok stopped doing that, scraping broke silently.

**Root issue**: The system depends on TikTok making fetch calls at the right time, with no fallback when it doesn't happen. The remote config system already allows updating endpoints/selectors without a new extension release, but the code itself has several single-point-of-failure patterns.

## Recommended changes

### 1. Proactive param capture — don't wait, intercept eagerly
**File**: `page-script.ts` ~lines 185-207, 488-497

Currently the fetch interceptor only captures params from the first matching fetch, and `waitForCapturedParams` polls for 15s hoping TikTok makes a call. Instead:

- **Remove the `!capturedCommentParams` guard** on the interceptor so it always updates with the latest params (keeps them fresh if TikTok changes tokens mid-session)
- **In `waitForCapturedParams`**: if params aren't captured after the timeout, attempt to **trigger** a comment fetch by scrolling the comments panel or clicking the comments button, then wait a shorter additional window

### 2. Extract params from page state as fallback
**File**: `page-script.ts` — new function near `waitForCapturedParams`

If no fetch is intercepted, try extracting the base params from TikTok's page state:
- Check `window.__NEXT_DATA__` or `window.SIGI_STATE` for pre-loaded comment API data
- Extract cookie-based tokens (`msToken`, `tt_chain_token`) directly
- Build params from known defaults + video-specific values already available (`aweme_id` from URL)

This is a fallback — less reliable than intercepting a real request, but better than timing out.

### 3. Retry API scrape before falling back to DOM
**File**: `video-scraper.ts` ~lines 1820-1984 (`fetchVideoCommentsViaApi`)

Currently, any `api-error` with `fallback: true` immediately falls through to DOM scraping. Instead:
- On `TIKTOK_PARAMS_TIMEOUT` or `TIKTOK_NO_SIGNING_FN`: wait 3s, reload the page, and retry the API path **once** before giving up
- This handles transient failures where TikTok's scripts haven't fully loaded

### 4. Sentry breadcrumbs for fetch interception
**File**: `page-script.ts` — fetch interceptor

Add lightweight telemetry so we can detect these issues before users report them:
- When `capturedCommentParams` is set, record a Sentry breadcrumb with the matched URL pattern
- When `waitForCapturedParams` times out, include in the Sentry error: how many total fetches were intercepted, whether any contained "comment" in the URL, and the elapsed time since page load

This doesn't change behavior but gives us visibility into what TikTok is doing.

## Files to modify
- `apps/extension/src/page-script.ts` — changes 1, 2, 4
- `apps/extension/src/content/tiktok/video-scraper.ts` — change 3

## Verification
1. Build extension, load in Chrome
2. Open a TikTok video, trigger comment scrape — should work via API path
3. To test fallback: temporarily change `interceptPattern` in remote config to something that won't match (e.g. `/api/comment/listXXX/`) — should still recover via page state extraction or retry
4. Verify Sentry breadcrumbs appear in the Sentry dashboard for successful and failed scrapes
