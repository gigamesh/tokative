/**
 * This script runs in the page context (not extension context) to access React internals.
 * It's injected via a <script> tag to bypass the content script isolation.
 *
 * Comment Hierarchy Structure:
 * - Top-level comments: DivCommentObjectWrapper contains DivCommentItemWrapper + DivReplyContainer
 * - Replies: Inside DivReplyContainer, each reply is a DivCommentItemWrapper
 * - Top-level comments use data-e2e="comment-level-1", replies use "comment-level-2"
 *
 * React fiber comment object contains:
 * - cid: unique comment ID
 * - reply_id: "0" for top-level, parent's cid for replies
 * - reply_to_reply_id: "0" or specific sub-reply's cid (for nested replies)
 * - reply_comment: array of preloaded replies (usually just 1)
 * - reply_comment_total: actual total reply count
 */

import { getAllCommentElements } from "./content/tiktok/video-selectors";

// TikTok's avatar structure from React fiber
interface TikTokAvatar {
  url_list?: string[];
  uri?: string;
}

// TikTok's comment user structure from React fiber
interface TikTokUser {
  uid: string;
  unique_id: string;
  nickname?: string;
  avatar_thumb?: TikTokAvatar;
}

// TikTok's comment structure from React fiber
interface TikTokComment {
  cid: string;
  create_time: number;
  aweme_id?: string;
  text?: string;
  user?: TikTokUser;
  reply_id?: string;
  reply_to_reply_id?: string;
  reply_comment_total?: number;
  reply_comment?: TikTokComment[];
}

// React fiber node structure (simplified - only what we need)
interface ReactFiber {
  memoizedProps?: {
    comment?: TikTokComment;
    children?: ReactChild | ReactChild[];
  };
  pendingProps?: {
    comment?: TikTokComment;
    children?: ReactChild | ReactChild[];
  };
  child?: ReactFiber;
  sibling?: ReactFiber;
  return?: ReactFiber;
}

interface ReactChild {
  props?: {
    comment?: TikTokComment;
  };
}

// Output format for extracted comment data
interface ExtractedComment {
  index: number;
  cid: string;
  create_time: number;
  aweme_id?: string;
  text?: string;
  user: { uid: string; unique_id: string; nickname?: string; avatar_thumb?: string } | null;
  reply_id?: string;
  reply_to_reply_id?: string;
  reply_comment_total: number;
  reply_comment: Array<{
    cid: string;
    create_time: number;
    text?: string;
    user: {
      uid: string;
      unique_id: string;
      nickname?: string;
      avatar_thumb?: string;
    } | null;
    reply_id?: string;
    reply_to_reply_id?: string;
  }>;
}

// Extend Element to include React fiber key
interface ElementWithFiber extends Element {
  [key: string]: ReactFiber | unknown;
}

(function () {
  // Store native fetch before patching — must be first thing in IIFE
  const nativeFetch = window.fetch.bind(window);

  // Captured fingerprinting params from TikTok's own comment API requests.
  // The fetch interceptor below captures these from TikTok's first /api/comment/list/ call.
  let capturedCommentParams: URLSearchParams | null = null;

  let cancelled = false;
  let activeAbortController: AbortController | null = null;

  const PER_REQUEST_PARAMS = new Set([
    "cursor", "count", "aweme_id", "item_id", "comment_id",
    "X-Bogus", "X-Gnarly", "msToken",
  ]);

  // Monkey-patch fetch to intercept TikTok's comment API calls and capture base params
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.includes("/api/comment/list/") && !url.includes("/reply/") && !capturedCommentParams) {
        const parsed = new URL(url);
        const params = new URLSearchParams();
        for (const [key, value] of parsed.searchParams) {
          if (!PER_REQUEST_PARAMS.has(key)) {
            params.set(key, value);
          }
        }
        capturedCommentParams = params;
      }
    } catch {
      // Ignore URL parse errors
    }
    return nativeFetch(input, init);
  } as typeof window.fetch;

  function findCommentElements(): Element[] {
    return getAllCommentElements();
  }

  function findCommentInProps(props: ReactFiber["memoizedProps"]): TikTokComment | null {
    if (!props) return null;

    if (props.comment?.cid) {
      return props.comment;
    }
    if (Array.isArray(props.children)) {
      for (const child of props.children) {
        if (child?.props?.comment?.cid) {
          return child.props.comment;
        }
      }
    }
    const singleChild = props.children as ReactChild | undefined;
    if (singleChild?.props?.comment?.cid) {
      return singleChild.props.comment;
    }
    return null;
  }

  function findCommentData(fiber: ReactFiber | null | undefined): TikTokComment | null {
    if (!fiber) return null;

    let current: ReactFiber | null | undefined = fiber;
    for (let i = 0; i < 15 && current; i++) {
      const memoResult = findCommentInProps(current.memoizedProps);
      if (memoResult) return memoResult;

      const pendingResult = findCommentInProps(current.pendingProps);
      if (pendingResult) return pendingResult;

      current = current.return;
    }

    return null;
  }

  function extractComments(): ExtractedComment[] {
    const results: ExtractedComment[] = [];
    const comments = findCommentElements();

    comments.forEach((el, index) => {
      const keys = Object.getOwnPropertyNames(el);
      const fiberKey = keys.find((k) => k.startsWith("__reactFiber$"));
      if (!fiberKey) {
        return;
      }

      const fiber = (el as ElementWithFiber)[fiberKey] as ReactFiber;
      const comment = findCommentData(fiber);

      if (comment?.cid && comment?.create_time) {
        results.push({
          index,
          cid: comment.cid,
          create_time: comment.create_time,
          aweme_id: comment.aweme_id,
          text: comment.text,
          user: comment.user
            ? {
                uid: comment.user.uid,
                unique_id: comment.user.unique_id,
                nickname: comment.user.nickname,
                avatar_thumb: comment.user.avatar_thumb?.url_list?.[0],
              }
            : null,
          reply_id: comment.reply_id,
          reply_to_reply_id: comment.reply_to_reply_id,
          reply_comment_total: comment.reply_comment_total || 0,
          reply_comment: (comment.reply_comment || []).map((r) => ({
            cid: r.cid,
            create_time: r.create_time,
            text: r.text,
            user: r.user
              ? {
                  uid: r.user.uid,
                  unique_id: r.user.unique_id,
                  nickname: r.user.nickname,
                  avatar_thumb: r.user.avatar_thumb?.url_list?.[0],
                }
              : null,
            reply_id: r.reply_id,
            reply_to_reply_id: r.reply_to_reply_id,
          })),
        });
      }
    });

    return results;
  }

  // Listen for extraction requests from content script
  document.addEventListener("tokative-extract", function () {
    const results = extractComments();
    document.documentElement.setAttribute(
      "data-tokative-comments",
      JSON.stringify(results),
    );
  });

  document.addEventListener("tokative-api-cancel", function () {
    cancelled = true;
    activeAbortController?.abort();
  });

  // === API-based comment fetching ===

  interface ApiCommentUser {
    uid: string;
    unique_id: string;
    nickname: string;
    avatar_thumb: { url_list: string[] };
  }

  interface ApiComment {
    cid: string;
    create_time: number;
    aweme_id: string;
    text: string;
    user: ApiCommentUser;
    reply_id: string;
    reply_to_reply_id: string;
    reply_comment_total: number;
    reply_comment: ApiComment[];
  }

  interface CommentListResponse {
    comments: ApiComment[];
    cursor: number;
    has_more: number;
    total: number;
    status_code: number;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type SigningFunction = (url: string) => any;

  let signingFn: SigningFunction | null = null;

  function dispatchApiEvent(eventName: string, data: unknown): void {
    document.documentElement.setAttribute(
      `data-tokative-${eventName}`,
      JSON.stringify(data),
    );
    document.dispatchEvent(new Event(`tokative-${eventName}`));
  }

  /** Searches known global entry points for TikTok's request-signing function. */
  function discoverSigningFunction(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;

    if (typeof win.byted_acrawler?.frontierSign === "function") {
      signingFn = (url: string) => win.byted_acrawler.frontierSign(url);
      return true;
    }

    for (const key of Object.getOwnPropertyNames(win)) {
      try {
        const val = win[key];
        if (val && typeof val === "object") {
          if (typeof val.frontierSign === "function") {
            signingFn = (url: string) => val.frontierSign(url);
            return true;
          }
          if (
            typeof val.sign === "function" &&
            /bogus|acrawler|signer|frontier/i.test(key)
          ) {
            signingFn = (url: string) => val.sign(url);
            return true;
          }
        }
      } catch {
        // Some properties throw on access
      }
    }

    return false;
  }

  function getMsToken(): string {
    const match = document.cookie.match(/(?:^|;\s*)msToken=([^;]+)/);
    return match ? match[1] : "";
  }

  /** Signs a URL by calling frontierSign and appending the X-Bogus query param. */
  async function signAndAppendBogus(url: string): Promise<string> {
    if (!signingFn) throw new Error("No signing function");
    const result = await signingFn(url);
    if (result && typeof result === "object" && "X-Bogus" in result) {
      return url + "&X-Bogus=" + encodeURIComponent(result["X-Bogus"]);
    }
    if (typeof result === "string") return result;
    return url;
  }

  function getAwemeId(): string | null {
    const match = window.location.href.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
  }

  function flattenApiComment(comment: ApiComment): ExtractedComment {
    return {
      index: 0,
      cid: comment.cid,
      create_time: comment.create_time,
      aweme_id: comment.aweme_id,
      text: comment.text,
      user: comment.user
        ? {
            uid: comment.user.uid,
            unique_id: comment.user.unique_id,
            nickname: comment.user.nickname,
            avatar_thumb: comment.user.avatar_thumb?.url_list?.[0],
          }
        : null,
      reply_id: comment.reply_id,
      reply_to_reply_id: comment.reply_to_reply_id,
      reply_comment_total: comment.reply_comment_total || 0,
      reply_comment: [],
    };
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Waits for the fetch interceptor to capture base params from TikTok's own API calls. */
  async function waitForCapturedParams(timeoutMs: number = 15000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (capturedCommentParams) return true;
      await sleep(500);
    }
    return false;
  }

  function buildCommentUrl(awemeId: string, cursor: number, count: number): string {
    const params = new URLSearchParams(capturedCommentParams!);
    params.set("aweme_id", awemeId);
    params.set("cursor", String(cursor));
    params.set("count", String(count));
    params.set("msToken", getMsToken());
    return "https://www.tiktok.com/api/comment/list/?" + params.toString();
  }

  function buildReplyUrl(commentId: string, awemeId: string, cursor: number, count: number): string {
    const params = new URLSearchParams(capturedCommentParams!);
    params.delete("aweme_id");
    params.set("item_id", awemeId);
    params.set("comment_id", commentId);
    params.set("cursor", String(cursor));
    params.set("count", String(count));
    params.set("msToken", getMsToken());
    return "https://www.tiktok.com/api/comment/list/reply/?" + params.toString();
  }

  async function parseJsonResponse(resp: Response): Promise<CommentListResponse> {
    const text = await resp.text();
    if (!text) throw new Error(`Empty response body (status ${resp.status})`);
    try {
      const data = JSON.parse(text);
      if (data.status_code !== 0) throw new Error(`TikTok status: ${data.status_code}`);
      return data;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`Invalid JSON from TikTok (status ${resp.status}, ${text.length} bytes)`);
      }
      throw err;
    }
  }

  async function fetchCommentPage(
    awemeId: string,
    cursor: number,
    count: number,
    signal?: AbortSignal,
  ): Promise<CommentListResponse> {
    const url = buildCommentUrl(awemeId, cursor, count);
    const signedUrl = await signAndAppendBogus(url);

    const resp = await nativeFetch(signedUrl, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });

    if (resp.status === 429) {
      const err = new Error("Rate limited") as Error & { status: number };
      err.status = 429;
      throw err;
    }

    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return parseJsonResponse(resp);
  }

  async function fetchReplyPage(
    commentId: string,
    awemeId: string,
    cursor: number,
    count: number,
    signal?: AbortSignal,
  ): Promise<CommentListResponse> {
    const url = buildReplyUrl(commentId, awemeId, cursor, count);
    const signedUrl = await signAndAppendBogus(url);

    const resp = await nativeFetch(signedUrl, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });

    if (resp.status === 429) {
      const err = new Error("Rate limited") as Error & { status: number };
      err.status = 429;
      throw err;
    }

    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    return parseJsonResponse(resp);
  }

  async function fetchWithRetry(
    fn: () => Promise<CommentListResponse>,
    backoffInitial: number,
    backoffMax: number,
    maxRetries: number,
    onRateLimit?: (backoffMs: number) => void,
  ): Promise<CommentListResponse> {
    let backoff = backoffInitial;
    for (let attempt = 0; ; attempt++) {
      if (cancelled) throw new Error("Cancelled");
      try {
        return await fn();
      } catch (err) {
        if (cancelled) throw err;
        const status = (err as Error & { status?: number }).status;
        const message = err instanceof Error ? err.message : "";
        const isRetryable = status === 429
          || message.includes("Empty response body")
          || message.includes("Invalid JSON");
        if (isRetryable && attempt < maxRetries) {
          if (status === 429) onRateLimit?.(backoff);
          await sleep(status === 429 ? backoff : 2000);
          backoff = Math.min(backoff * 2, backoffMax);
          continue;
        }
        throw err;
      }
    }
  }

  /** Fetches all comments (top-level + replies) for a video via TikTok's API. */
  async function fetchAllComments(config: {
    awemeId: string;
    apiPageDelay: number;
    apiBackoffInitial: number;
    apiBackoffMax: number;
  }): Promise<void> {
    const { awemeId, apiPageDelay, apiBackoffInitial, apiBackoffMax } = config;
    const BATCH_SIZE = 50;
    const PAGE_COUNT = 20;
    const MAX_RETRIES = 3;

    cancelled = false;
    const abortController = new AbortController();
    activeAbortController = abortController;
    const { signal } = abortController;

    let cursor = 0;
    let hasMore = true;
    let topLevelCount = 0;
    let replyCount = 0;
    let batch: ExtractedComment[] = [];
    const seenCids = new Set<string>();

    const flushBatch = () => {
      if (batch.length > 0) {
        dispatchApiEvent("api-batch", { comments: batch });
        batch = [];
      }
    };

    const reportProgress = (rateLimited = false, backoffMs = 0) => {
      dispatchApiEvent("api-progress", {
        topLevel: topLevelCount,
        replies: replyCount,
        hasMore,
        rateLimited,
        backoffMs,
      });
    };

    const addComment = (c: ExtractedComment) => {
      if (seenCids.has(c.cid)) return;
      seenCids.add(c.cid);
      batch.push(c);
      if (batch.length >= BATCH_SIZE) flushBatch();
    };

    try {
      while (hasMore && !cancelled) {
        const page = await fetchWithRetry(
          () => fetchCommentPage(awemeId, cursor, PAGE_COUNT, signal),
          apiBackoffInitial,
          apiBackoffMax,
          MAX_RETRIES,
          (ms) => reportProgress(true, ms),
        );

        if (cancelled) break;
        if (!page.comments?.length) {
          hasMore = false;
          break;
        }

        for (const comment of page.comments) {
          if (cancelled) break;

          topLevelCount++;
          addComment(flattenApiComment(comment));

          const preloaded = comment.reply_comment || [];
          for (const r of preloaded) {
            replyCount++;
            addComment(flattenApiComment(r));
          }

          if (comment.reply_comment_total > preloaded.length) {
            let replyCursor = preloaded.length;
            let repliesHasMore = true;

            while (repliesHasMore && !cancelled) {
              const replyPage = await fetchWithRetry(
                () => fetchReplyPage(comment.cid, awemeId, replyCursor, PAGE_COUNT, signal),
                apiBackoffInitial,
                apiBackoffMax,
                MAX_RETRIES,
                (ms) => reportProgress(true, ms),
              );

              if (cancelled) break;
              if (!replyPage.comments?.length) break;

              for (const reply of replyPage.comments) {
                replyCount++;
                addComment(flattenApiComment(reply));
              }

              replyCursor = replyPage.cursor;
              repliesHasMore = replyPage.has_more === 1;
              if (repliesHasMore) await sleep(apiPageDelay);
            }
          }
        }

        if (cancelled) break;
        reportProgress();
        cursor = page.cursor;
        hasMore = page.has_more === 1;
        if (hasMore) await sleep(apiPageDelay);
      }
    } catch (err) {
      if (!cancelled) throw err;
    } finally {
      activeAbortController = null;
    }

    flushBatch();
    dispatchApiEvent("api-complete", {
      topLevel: topLevelCount,
      replies: replyCount,
    });
  }

  document.addEventListener("tokative-api-start", async () => {
    cancelled = false;

    const configStr = document.documentElement.getAttribute("data-tokative-api-config");
    document.documentElement.removeAttribute("data-tokative-api-config");

    const config = configStr ? JSON.parse(configStr) : {};
    const awemeId = config.awemeId || getAwemeId();

    if (!awemeId) {
      dispatchApiEvent("api-error", { error: "Could not determine video ID", fallback: true });
      return;
    }

    if (!discoverSigningFunction()) {
      dispatchApiEvent("api-error", { error: "Signing function not found", fallback: true });
      return;
    }

    const hasCapturedParams = await waitForCapturedParams(15000);
    if (!hasCapturedParams) {
      dispatchApiEvent("api-error", { error: "Could not capture API params from TikTok", fallback: true });
      return;
    }

    try {
      await fetchAllComments({
        awemeId,
        apiPageDelay: config.apiPageDelay || 500,
        apiBackoffInitial: config.apiBackoffInitial || 5000,
        apiBackoffMax: config.apiBackoffMax || 60000,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      dispatchApiEvent("api-error", { error: message, fallback: true });
    }
  });

  // Signal that the script is ready
  document.documentElement.setAttribute("data-tokative-ready", "true");
})();
