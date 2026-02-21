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

import type { ExtensionConfig } from "@tokative/shared";
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

  const DEFAULT_API_CONFIG: ExtensionConfig['api'] = {
    endpoints: {
      commentList: "https://www.tiktok.com/api/comment/list/?",
      commentReply: "https://www.tiktok.com/api/comment/list/reply/?",
    },
    interceptPattern: "/api/comment/list/",
    replyPathSegment: "/reply/",
    params: {
      videoId: "aweme_id", itemId: "item_id", commentId: "comment_id",
      cursor: "cursor", count: "count", msToken: "msToken",
    },
    perRequestParams: [
      "cursor", "count", "aweme_id", "item_id", "comment_id",
      "X-Bogus", "X-Gnarly", "msToken",
    ],
    response: {
      comments: "comments", cursor: "cursor", hasMore: "has_more",
      total: "total", statusCode: "status_code", successValue: 0, hasMoreValue: 1,
    },
    commentFields: {
      id: "cid", createTime: "create_time", videoId: "aweme_id", text: "text",
      user: "user", replyId: "reply_id", replyToReplyId: "reply_to_reply_id",
      replyCount: "reply_comment_total", replies: "reply_comment",
    },
    userFields: {
      id: "uid", uniqueId: "unique_id", nickname: "nickname",
      avatarThumb: "avatar_thumb", avatarUrlList: "url_list",
    },
    signing: {
      primaryPath: "byted_acrawler.frontierSign",
      fallbackMethod: "frontierSign",
      fallbackSign: "sign",
      fallbackKeyPattern: "bogus|acrawler|signer|frontier",
    },
    cookie: { tokenName: "msToken", tokenPattern: "(?:^|;\\s*)msToken=([^;]+)" },
    pagination: { pageCount: 20, batchSize: 50, maxRetries: 3, capturedParamsTimeout: 15000 },
  };

  let apiConfig: ExtensionConfig['api'] = DEFAULT_API_CONFIG;

  // Captured fingerprinting params from TikTok's own comment API requests.
  // The fetch interceptor below captures these from TikTok's first /api/comment/list/ call.
  let capturedCommentParams: URLSearchParams | null = null;

  let cancelled = false;
  let activeAbortController: AbortController | null = null;
  let tiktokFetch: typeof fetch = nativeFetch;
  let isOurRequest = false;
  let interceptCount = 0;
  const diagLogs: string[] = [];

  /** Appends a timestamped DIAG entry to the in-memory log buffer (silent — use __DIAG_LOGS or tokative-dump-logs to inspect). */
  function diag(tag: string, data: Record<string, unknown>): void {
    diagLogs.push(`[${new Date().toISOString()}][DIAG:${tag}] ${JSON.stringify(data)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__DIAG_LOGS = diagLogs;

  document.addEventListener("tokative-dump-logs", () => {
    const blob = new Blob([diagLogs.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `diag-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // Monkey-patch fetch to intercept TikTok's comment API calls and capture base params
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.includes(apiConfig.interceptPattern)) {
        diag("intercept", {
          n: ++interceptCount,
          source: isOurRequest ? "ours" : "organic",
          urlParamCount: new URL(url).searchParams.size,
        });
      }
      if (
        url.includes(apiConfig.interceptPattern) &&
        !url.includes(apiConfig.replyPathSegment)
      ) {
        const perRequest = new Set(apiConfig.perRequestParams);
        const parsed = new URL(url);
        const params = new URLSearchParams();
        for (const [key, value] of parsed.searchParams) {
          if (!perRequest.has(key)) {
            params.set(key, value);
          }
        }
        capturedCommentParams = params;
        document.documentElement.setAttribute("data-tokative-params-ready", "true");
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
      if (!fiberKey) return;

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

  /** Translates a raw API comment object into the typed ApiComment interface using configurable field names. */
  function mapComment(raw: Record<string, unknown>): ApiComment {
    const cf = apiConfig.commentFields;
    const uf = apiConfig.userFields;
    const rawUser = raw[cf.user] as Record<string, unknown> | undefined;
    return {
      cid: String(raw[cf.id] ?? ""),
      create_time: Number(raw[cf.createTime] ?? 0),
      aweme_id: String(raw[cf.videoId] ?? ""),
      text: String(raw[cf.text] ?? ""),
      user: rawUser
        ? {
            uid: String(rawUser[uf.id] ?? ""),
            unique_id: String(rawUser[uf.uniqueId] ?? ""),
            nickname: String(rawUser[uf.nickname] ?? ""),
            avatar_thumb: {
              url_list:
                ((rawUser[uf.avatarThumb] as Record<string, unknown> | undefined)?.[uf.avatarUrlList] as string[]) ??
                [],
            },
          }
        : { uid: "", unique_id: "", nickname: "", avatar_thumb: { url_list: [] } },
      reply_id: String(raw[cf.replyId] ?? "0"),
      reply_to_reply_id: String(raw[cf.replyToReplyId] ?? "0"),
      reply_comment_total: Number(raw[cf.replyCount] ?? 0),
      reply_comment: ((raw[cf.replies] as Record<string, unknown>[]) ?? []).map(mapComment),
    };
  }

  /** Translates a raw API response into the typed CommentListResponse using configurable field names. */
  function mapResponse(raw: Record<string, unknown>): CommentListResponse {
    const r = apiConfig.response;
    return {
      comments: ((raw[r.comments] ?? []) as Record<string, unknown>[]).map(mapComment),
      cursor: Number(raw[r.cursor] ?? 0),
      has_more: Number(raw[r.hasMore] ?? 0),
      total: Number(raw[r.total] ?? 0),
      status_code: Number(raw[r.statusCode] ?? 0),
    };
  }

  /** Searches known global entry points for TikTok's request-signing function. */
  function discoverSigningFunction(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const signing = apiConfig.signing;

    const pathParts = signing.primaryPath.split(".");
    if (pathParts.length === 2) {
      const obj = win[pathParts[0]];
      if (obj && typeof obj[pathParts[1]] === "function") {
        signingFn = (url: string) => obj[pathParts[1]](url);
        return true;
      }
    }

    const fallbackPattern = new RegExp(signing.fallbackKeyPattern, "i");
    for (const key of Object.getOwnPropertyNames(win)) {
      try {
        const val = win[key];
        if (val && typeof val === "object") {
          if (typeof val[signing.fallbackMethod] === "function") {
            signingFn = (url: string) => val[signing.fallbackMethod](url);
            return true;
          }
          if (
            typeof val[signing.fallbackSign] === "function" &&
            fallbackPattern.test(key)
          ) {
            signingFn = (url: string) => val[signing.fallbackSign](url);
            return true;
          }
        }
      } catch {
        // Some properties throw on access
      }
    }

    return false;
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

  function buildDiagSummary() {
    return {
      totalIntercepts: interceptCount,
      organicIntercepts: diagLogs.filter(l => l.includes('"organic"')).length,
      totalDiagEntries: diagLogs.length,
      lastEntries: diagLogs.slice(-5),
    };
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Waits for the fetch interceptor to capture base params from TikTok's own API calls. */
  async function waitForCapturedParams(): Promise<boolean> {
    const timeout = apiConfig.pagination.capturedParamsTimeout;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (capturedCommentParams) return true;
      await sleep(500);
    }
    return false;
  }

  function buildCommentUrl(awemeId: string, cursor: number, count: number): string {
    const p = apiConfig.params;
    const params = new URLSearchParams(capturedCommentParams!);
    params.set(p.videoId, awemeId);
    params.set(p.cursor, String(cursor));
    params.set(p.count, String(count));
    return apiConfig.endpoints.commentList + params.toString();
  }

  function buildReplyUrl(commentId: string, awemeId: string, cursor: number, count: number): string {
    const p = apiConfig.params;
    const params = new URLSearchParams(capturedCommentParams!);
    params.delete(p.videoId);
    params.set(p.itemId, awemeId);
    params.set(p.commentId, commentId);
    params.set(p.cursor, String(cursor));
    params.set(p.count, String(count));
    return apiConfig.endpoints.commentReply + params.toString();
  }

  async function parseJsonResponse(resp: Response): Promise<CommentListResponse> {
    const text = await resp.text();

    diag("comment-api", {
      status: resp.status,
      bodyLen: text.length,
      contentType: resp.headers.get("content-type"),
      bodyPreview: text.slice(0, 200),
    });

    if (!text) {
      throw new Error("Empty response body");
    }
    try {
      const raw = JSON.parse(text) as Record<string, unknown>;
      const statusCode = Number(raw[apiConfig.response.statusCode] ?? -1);
      if (statusCode !== apiConfig.response.successValue) {
        throw new Error(`TikTok status: ${statusCode}`);
      }
      return mapResponse(raw);
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

    diag("fetch", { cursor });

    isOurRequest = true;
    const resp = await tiktokFetch(url, { credentials: "include", signal });
    isOurRequest = false;

    if (resp.status === 429) {
      const err = new Error("Rate limited by TikTok — try again in a few minutes") as Error & { status: number };
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

    diag("fetch-reply", { commentId, cursor });

    isOurRequest = true;
    const resp = await tiktokFetch(url, { credentials: "include", signal });
    isOurRequest = false;

    if (resp.status === 429) {
      const err = new Error("Rate limited by TikTok — try again in a few minutes") as Error & { status: number };
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

        diag("retry", { attempt, status, message, backoff });

        const isRateLimited = status === 429;
        const isEmptyBody = message.includes("Empty response body");
        const isRetryable = isRateLimited || isEmptyBody || message.includes("Invalid JSON");
        if (isRetryable && attempt < maxRetries) {
          if (isRateLimited || isEmptyBody) onRateLimit?.(backoff);
          await sleep((isRateLimited || isEmptyBody) ? backoff : 2000);
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
    const { batchSize, pageCount, maxRetries } = apiConfig.pagination;
    const hasMoreValue = apiConfig.response.hasMoreValue;
    let pageNumber = 0;
    let consecutiveEmptyPages = 0;

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
      if (batch.length >= batchSize) flushBatch();
    };

    try {
      while (hasMore && !cancelled) {
        const page = await fetchWithRetry(
          () => fetchCommentPage(awemeId, cursor, pageCount, signal),
          apiBackoffInitial,
          apiBackoffMax,
          maxRetries,
          (ms) => reportProgress(true, ms),
        );

        if (cancelled) break;
        pageNumber++;

        if (!page.comments?.length) {
          if (page.has_more === hasMoreValue && consecutiveEmptyPages < 3) {
            consecutiveEmptyPages++;
            await sleep(apiPageDelay + 1000);
            continue;
          }
          hasMore = false;
          break;
        }
        consecutiveEmptyPages = 0;

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
                () => fetchReplyPage(comment.cid, awemeId, replyCursor, pageCount, signal),
                apiBackoffInitial,
                apiBackoffMax,
                maxRetries,
                (ms) => reportProgress(true, ms),
              );

              if (cancelled) break;
              if (!replyPage.comments?.length) break;

              for (const reply of replyPage.comments) {
                replyCount++;
                addComment(flattenApiComment(reply));
              }

              replyCursor = replyPage.cursor;
              repliesHasMore = replyPage.has_more === hasMoreValue;
              if (repliesHasMore) await sleep(apiPageDelay);
            }
          }
        }

        if (cancelled) break;
        reportProgress();
        cursor = page.cursor;
        hasMore = page.has_more === hasMoreValue;

        diag("pagination", {
          cursor,
          hasMore,
          topLevelCount,
          replyCount,
          pageCommentsCount: page.comments?.length,
        });

        if (hasMore) {
          const adaptiveDelay = Math.min(
            apiPageDelay + Math.floor(pageNumber / 10) * 200,
            3000,
          );
          await sleep(adaptiveDelay);
        }
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
      diag: buildDiagSummary(),
    });
  }

  document.addEventListener("tokative-api-start", async () => {
    cancelled = false;
    tiktokFetch = window.fetch.bind(window);

    diag("api-start", {
      tiktokFetchIsNative: tiktokFetch === nativeFetch,
      windowFetchStr: window.fetch.toString().slice(0, 100),
    });

    const configStr = document.documentElement.getAttribute("data-tokative-api-config");
    document.documentElement.removeAttribute("data-tokative-api-config");

    const config = configStr ? JSON.parse(configStr) : {};
    const awemeId = config.awemeId || getAwemeId();

    if (config.api) {
      apiConfig = { ...DEFAULT_API_CONFIG, ...config.api };
      for (const key of Object.keys(DEFAULT_API_CONFIG) as (keyof ExtensionConfig['api'])[]) {
        const defaultVal = DEFAULT_API_CONFIG[key];
        if (typeof defaultVal === "object" && defaultVal !== null && !Array.isArray(defaultVal)) {
          (apiConfig as unknown as Record<string, unknown>)[key] = {
            ...(defaultVal as Record<string, unknown>),
            ...((config.api[key] ?? {}) as Record<string, unknown>),
          };
        }
      }
    }

    if (!awemeId) {
      dispatchApiEvent("api-error", { error: "Could not determine video ID", fallback: true, diag: buildDiagSummary() });
      return;
    }

    if (!discoverSigningFunction()) {
      dispatchApiEvent("api-error", { error: "Signing function not found", fallback: true, diag: buildDiagSummary() });
      return;
    }

    const hasCapturedParams = await waitForCapturedParams();
    if (!hasCapturedParams) {
      dispatchApiEvent("api-error", { error: "Could not capture API params from TikTok", fallback: true, diag: buildDiagSummary() });
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
      dispatchApiEvent("api-error", { error: message, fallback: true, diag: buildDiagSummary() });
    }
  });

  // Signal that the script is ready
  document.documentElement.setAttribute("data-tokative-ready", "true");
})();
