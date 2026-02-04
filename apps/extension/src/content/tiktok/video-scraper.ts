import type {
  ScrapeStats,
  ScrapedComment,
  ScrapedVideo,
  VideoMetadataScrapeProgress,
  VideoScrapeProgress,
} from "../../types";
import { humanDelay, humanDelayWithJitter, isVisible } from "../../utils/dom";
import { addScrapedComments, addVideos } from "../../utils/storage";
import { querySelector, querySelectorAll, waitForSelector } from "./selectors";
import { getAllCommentElements, VIDEO_SELECTORS } from "./video-selectors";
import { getLoadedConfig } from "../../config/loader";

interface DiagnosticData {
  displayedCount: number | null;
  scrapedTotal: number;
  topLevelCount: number;
  replyCount: number;
  incompleteThreads: Array<{ parentId: string; expected: number; got: number }>;
}

interface RawCommentData {
  commentId: string;
  tiktokUserId: string;
  handle: string;
  displayName: string;
  comment: string;
  createTime: number;
  videoId: string;
  avatarUrl?: string;
  parentCommentId?: string | null;
  replyToReplyId?: string | null;
  replyCount?: number;
}

let isCancelled = false;
let isPaused = false;

// Set to true to enable verbose logging
const DEBUG_VERBOSE = true;
const log = (...args: unknown[]) => DEBUG_VERBOSE && console.log(...args);

export function cancelVideoScrape(): void {
  isCancelled = true;
}

export function pauseVideoScrape(): void {
  isPaused = true;
}

export function resumeVideoScrape(): void {
  isPaused = false;
}

async function waitWhilePaused(): Promise<void> {
  while (isPaused && !isCancelled) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

function extractHandleFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const match = href.match(/\/@([^/?]+)/);
  return match ? match[1] : null;
}

function extractVideoIdFromUrl(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

export function getVideoId(): string | null {
  for (const selector of VIDEO_SELECTORS.videoMetaUrl) {
    const el = document.querySelector<HTMLMetaElement>(selector);
    if (el?.content) {
      const videoId = extractVideoIdFromUrl(el.content);
      if (videoId) return videoId;
    }
  }

  // Fallback: try to get video ID from current URL
  return extractVideoIdFromUrl(window.location.href);
}

interface CommentReactData {
  cid: string;
  create_time: number;
  aweme_id: string;
  text?: string;
  user?: { uid: string; unique_id: string; nickname?: string; avatar_thumb?: string };
  reply_id?: string;
  reply_to_reply_id?: string;
  reply_comment_total?: number;
  reply_comment?: Array<{
    cid: string;
    create_time: number;
    text?: string;
    user?: { uid: string; unique_id: string; nickname?: string; avatar_thumb?: string };
    reply_id?: string;
    reply_to_reply_id?: string;
  }>;
}

export function injectReactExtractor(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById("tokative-extractor")) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = "tokative-extractor";
    script.src = chrome.runtime.getURL("page-script.js");
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.documentElement.appendChild(script);
  });
}

function parseCommentCount(text: string): number | null {
  if (!text) return null;
  const cleaned = text.trim().toLowerCase();
  if (cleaned.includes("k")) {
    const num = parseFloat(cleaned.replace("k", ""));
    return Math.round(num * 1000);
  }
  if (cleaned.includes("m")) {
    const num = parseFloat(cleaned.replace("m", ""));
    return Math.round(num * 1000000);
  }
  const num = parseInt(cleaned.replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? null : num;
}

export function getDisplayedCommentCount(): number | null {
  for (const selector of VIDEO_SELECTORS.commentCount) {
    const el = document.querySelector(selector);
    if (el?.textContent) {
      const count = parseCommentCount(el.textContent);
      if (count !== null) {
        return count;
      }
    }
  }
  return null;
}

function logDiagnosticSummary(
  diagnostics: DiagnosticData,
  _comments: ScrapedComment[],
): void {
  const { displayedCount, scrapedTotal, topLevelCount, replyCount, incompleteThreads } = diagnostics;

  const displayedStr = displayedCount !== null ? displayedCount.toString() : "N/A";
  const capturedPct = scrapedTotal > 0 && displayedCount
    ? ((scrapedTotal / displayedCount) * 100).toFixed(1)
    : "N/A";

  log(`[Tokative] Scrape Summary: Displayed=${displayedStr}, Scraped=${scrapedTotal}, TopLevel=${topLevelCount}, Replies=${replyCount}, CaptureRate=${capturedPct}%`);

  if (incompleteThreads.length > 0) {
    const sorted = incompleteThreads
      .map((t) => ({ ...t, missing: t.expected - t.got }))
      .sort((a, b) => b.missing - a.missing)
      .slice(0, 5);

    log(`[Tokative] Incomplete threads (top ${sorted.length}): ${sorted.map(t => `${t.parentId}:${t.got}/${t.expected}`).join(", ")}`);
  }
}

export async function extractAllReactData(): Promise<Map<number, CommentReactData>> {
  await injectReactExtractor();

  const isReady =
    document.documentElement.getAttribute("data-tokative-ready") === "true";
  log("[Tokative] React extractor ready:", isReady);
  if (!isReady) {
    return new Map();
  }

  // Trigger extraction via a custom event
  const extractEvent = new CustomEvent("tokative-extract");
  document.dispatchEvent(extractEvent);

  // Wait for the extraction to complete - allow React to settle
  const config = getLoadedConfig();
  await new Promise((resolve) => setTimeout(resolve, config.delays.reactSettle));

  const dataAttr = document.documentElement.getAttribute(
    "data-tokative-comments",
  );
  document.documentElement.removeAttribute("data-tokative-comments");

  log("[Tokative] React data attribute length:", dataAttr?.length || 0);

  const results = new Map<number, CommentReactData>();
  if (dataAttr) {
    try {
      const parsed = JSON.parse(dataAttr) as Array<{
        index: number;
        cid: string;
        create_time: number;
        aweme_id: string;
        text?: string;
        user?: { uid: string; unique_id: string; nickname?: string; avatar_thumb?: string };
        reply_id?: string;
        reply_to_reply_id?: string;
        reply_comment_total?: number;
        reply_comment?: Array<{
          cid: string;
          create_time: number;
          text?: string;
          user?: { uid: string; unique_id: string; nickname?: string; avatar_thumb?: string };
          reply_id?: string;
          reply_to_reply_id?: string;
        }>;
      }>;
      log("[Tokative] Parsed React data for", parsed.length, "comments");
      for (const item of parsed) {
        results.set(item.index, {
          cid: item.cid,
          create_time: item.create_time,
          aweme_id: item.aweme_id,
          text: item.text,
          user: item.user,
          reply_id: item.reply_id,
          reply_to_reply_id: item.reply_to_reply_id,
          reply_comment_total: item.reply_comment_total,
          reply_comment: item.reply_comment,
        });
      }
    } catch (e) {
      console.error("[Tokative] Failed to parse React data:", e);
    }
  }

  return results;
}

function extractCommentFromDOM(
  commentContainer: Element,
): Partial<RawCommentData> | null {
  // The comment content container has the comment ID as its id attribute
  const contentContainer = commentContainer.querySelector(
    '[class*="DivCommentContentContainer"]',
  );
  const commentId = contentContainer?.id || commentContainer.id || "";

  // First try to find an anchor element with href
  let usernameEl = querySelector<HTMLAnchorElement>(
    VIDEO_SELECTORS.commentUsername,
    commentContainer,
  );

  // If we found an element but it's not an anchor, look for an anchor inside it
  if (usernameEl && usernameEl.tagName !== "A") {
    const anchorInside = usernameEl.querySelector("a");
    if (anchorInside) {
      usernameEl = anchorInside;
    }
  }

  // Also try the parent anchor if username element doesn't have href
  if (usernameEl && !usernameEl.href) {
    const parentAnchor = usernameEl.closest("a");
    if (parentAnchor?.href) {
      usernameEl = parentAnchor;
    }
  }

  if (!usernameEl) return null;

  const handle = extractHandleFromHref(usernameEl.href);
  if (!handle) return null;

  const displayName = usernameEl.textContent?.trim() || handle;

  const textEl = querySelector(VIDEO_SELECTORS.commentText, commentContainer);
  const comment = textEl?.textContent?.trim() || "";

  return { handle, displayName, comment, commentId };
}

/**
 * Extracts all comments (top-level and replies) from the current video's comment section.
 *
 * Comment Hierarchy:
 * - Top-level comments have reply_id="0" (stored as parentCommentId=null)
 * - Replies have reply_id set to parent's cid (stored as parentCommentId)
 * - Sub-replies (reply to a reply) also have reply_to_reply_id set
 *
 * Data Sources:
 * 1. DOM extraction: Gets handle, display name, comment text from visible elements
 * 2. React fiber: Gets cid, timestamps, reply hierarchy, preloaded reply_comment array
 *
 * The reply_comment array in React data only contains ~1 preloaded reply per thread.
 * To get all replies, expandAndSaveReplies() clicks "View X replies" buttons,
 * which loads replies as new DOM elements with their own React data.
 */
export async function scrapeCommentsFromCurrentVideo(): Promise<
  RawCommentData[]
> {
  const videoId = getVideoId();
  log("[Tokative] Video ID from URL:", videoId);

  // Get React data - this is our primary data source
  const reactDataMap = await extractAllReactData();
  log("[Tokative] React data map size:", reactDataMap.size);

  // Log first comment's aweme_id to check for mismatch
  if (reactDataMap.size > 0) {
    const firstData = reactDataMap.values().next().value;
    if (firstData?.aweme_id && firstData.aweme_id !== videoId) {
      console.warn(
        `[Tokative] VIDEO ID MISMATCH: URL says "${videoId}" but React data has aweme_id "${firstData.aweme_id}"`,
      );
    }
  }

  const comments: RawCommentData[] = [];
  const seenIds = new Set<string>();
  let repliesFound = 0;

  // Get DOM elements to check for static stickers (same ordering as page-script)
  const commentElements = getAllCommentElements();
  const stickerSelector = VIDEO_SELECTORS.commentStickerImage[0];

  // Use React data directly - it has all the info we need (cid, text, user, reply_id)
  // This avoids index mismatch issues between page-script and content-script
  for (const [index, reactData] of reactDataMap) {
    const commentId = reactData.cid;
    if (!commentId) continue;

    // Deduplicate by commentId
    if (seenIds.has(commentId)) continue;
    seenIds.add(commentId);

    const parentCommentId =
      reactData.reply_id !== "0" ? reactData.reply_id : null;
    if (parentCommentId) {
      repliesFound++;
    }

    // Check for static sticker image in DOM and normalize text
    let commentText = reactData.text || "";
    const domElement = commentElements[index];
    if (domElement && !commentText.includes("[sticker]")) {
      const hasStickerImage = domElement.querySelector(stickerSelector) !== null;
      if (hasStickerImage) {
        commentText = commentText ? `${commentText} [sticker]` : "[sticker]";
      }
    }

    const comment: RawCommentData = {
      commentId,
      tiktokUserId: reactData.user?.uid || "",
      handle: reactData.user?.unique_id || "",
      displayName: reactData.user?.nickname || reactData.user?.unique_id || "",
      comment: commentText,
      createTime: reactData.create_time || Math.floor(Date.now() / 1000),
      // Prefer URL videoId since that's what web app uses for filtering
      videoId: videoId || reactData.aweme_id || "",
      avatarUrl: reactData.user?.avatar_thumb,
      parentCommentId,
      replyToReplyId:
        reactData.reply_to_reply_id !== "0"
          ? reactData.reply_to_reply_id
          : null,
      replyCount: reactData.reply_comment_total,
    };

    comments.push(comment);

    // Also extract preloaded replies from the reply_comment array
    if (reactData.reply_comment) {
      for (const reply of reactData.reply_comment) {
        if (seenIds.has(reply.cid)) continue;
        seenIds.add(reply.cid);

        const replyParentId =
          reply.reply_id !== "0" ? reply.reply_id : commentId;
        if (replyParentId) repliesFound++;

        comments.push({
          commentId: reply.cid,
          tiktokUserId: reply.user?.uid || "",
          handle: reply.user?.unique_id || "",
          displayName: reply.user?.nickname || "",
          comment: reply.text || "",
          createTime: reply.create_time || Math.floor(Date.now() / 1000),
          // Prefer URL videoId since that's what web app uses for filtering
          videoId: videoId || reactData.aweme_id || "",
          avatarUrl: reply.user?.avatar_thumb,
          parentCommentId: replyParentId,
          replyToReplyId:
            reply.reply_to_reply_id !== "0" ? reply.reply_to_reply_id : null,
        });
      }
    }
  }

  log(
    `[Tokative] Extracted ${comments.length} comments from React data, ${repliesFound} are replies`,
  );
  return comments;
}

function getVideoAuthorFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/@([^/?]+)/);
  return match ? match[1] : null;
}

/**
 * Converts raw extracted comment data to the ScrapedComment format for storage.
 *
 * Hierarchy fields:
 * - parentCommentId: null for top-level comments, parent's cid for replies
 * - replyToReplyId: set when replying to a specific sub-reply (not just the thread)
 * - isReply: convenience boolean, true when parentCommentId is set
 * - replyCount: total replies (only set for top-level comments)
 *
 * The videoUrl includes a cid parameter (base64 encoded) to link directly to the comment.
 */
export function rawCommentToScrapedComment(
  raw: RawCommentData,
  source: "app" | "scraped" = "scraped",
): ScrapedComment | null {
  if (!raw.commentId) {
    return null;
  }

  const cid = btoa(raw.commentId);
  const videoAuthor = getVideoAuthorFromUrl();
  const videoUrl =
    raw.videoId && videoAuthor
      ? `https://www.tiktok.com/@${videoAuthor}/video/${raw.videoId}?cid=${cid}`
      : undefined;

  return {
    id: raw.commentId,
    tiktokUserId: raw.tiktokUserId,
    handle: raw.handle,
    comment: raw.comment,
    scrapedAt: new Date().toISOString(),
    profileUrl: `https://www.tiktok.com/@${raw.handle}`,
    avatarUrl: raw.avatarUrl,
    videoUrl,
    commentTimestamp: new Date(raw.createTime * 1000).toISOString(),
    commentId: raw.commentId,
    videoId: raw.videoId,
    parentCommentId: raw.parentCommentId || null,
    replyToReplyId: raw.replyToReplyId || null,
    isReply: !!raw.parentCommentId,
    replyCount: raw.replyCount,
    source,
  };
}

export interface FindReplyOptions {
  parentCommentId: string;
  replyText: string;
  ourHandle?: string;
  maxAgeSeconds?: number;
}

function stripAtMention(text: string): string {
  return text.replace(/^@[\w.]+\s*/, "").trim();
}

function textsMatch(expected: string, found: string): boolean {
  const normalizedExpected = expected.toLowerCase().trim();
  const normalizedFound = found.toLowerCase().trim();
  const foundNoMention = stripAtMention(normalizedFound).toLowerCase();

  return (
    normalizedFound === normalizedExpected ||
    foundNoMention === normalizedExpected ||
    normalizedFound.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedFound) ||
    foundNoMention.includes(normalizedExpected)
  );
}

export async function findRecentlyPostedReply(
  options: FindReplyOptions,
): Promise<ScrapedComment | null> {
  const { parentCommentId, replyText, ourHandle, maxAgeSeconds = 60 } = options;
  const ourHandleLower = ourHandle?.toLowerCase();
  const nowSeconds = Math.floor(Date.now() / 1000);

  log(`[Tokative] findRecentlyPostedReply: looking for reply${ourHandle ? ` by @${ourHandle}` : ""} to comment ${parentCommentId}`);

  const reactDataMap = await extractAllReactData();
  log(`[Tokative] findRecentlyPostedReply: extracted ${reactDataMap.size} comments from React`);

  const videoId = getVideoId();

  for (const [, data] of reactDataMap) {
    if (!data.cid || !data.user) continue;

    const handleMatches = ourHandleLower ? data.user.unique_id?.toLowerCase() === ourHandleLower : true;
    const isReplyToParent = data.reply_id === parentCommentId;
    const ageSeconds = nowSeconds - (data.create_time || 0);
    const isRecent = ageSeconds <= maxAgeSeconds && ageSeconds >= 0;
    const textMatches = textsMatch(replyText, data.text || "");

    if (handleMatches && isReplyToParent && isRecent && textMatches) {
      log(`[Tokative] findRecentlyPostedReply: found match - cid=${data.cid}, age=${ageSeconds}s`);

      const rawComment: RawCommentData = {
        commentId: data.cid,
        tiktokUserId: data.user.uid || "",
        handle: data.user.unique_id || "",
        displayName: data.user.nickname || "",
        comment: data.text || "",
        createTime: data.create_time || nowSeconds,
        videoId: videoId || data.aweme_id || "",
        avatarUrl: data.user.avatar_thumb,
        parentCommentId,
        replyToReplyId: data.reply_to_reply_id !== "0" ? data.reply_to_reply_id : null,
      };

      return rawCommentToScrapedComment(rawComment, "app");
    }
  }

  log(`[Tokative] findRecentlyPostedReply: no matching reply found`);
  return null;
}

export async function findRecentlyPostedReplyWithRetry(
  options: FindReplyOptions,
  maxRetries: number = 5,
  initialDelayMs: number = 200,
): Promise<ScrapedComment | null> {
  let delayMs = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(`[Tokative] findRecentlyPostedReplyWithRetry: attempt ${attempt}/${maxRetries}`);
    const result = await findRecentlyPostedReply(options);
    if (result) {
      return result;
    }
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 1.5, 1000); // Exponential backoff capped at 1s
    }
  }
  return null;
}

/**
 * Expands all visible reply threads by clicking "View X replies" / "View X more" buttons.
 * Called during scroll loop to capture replies before DOM virtualization recycles elements.
 *
 * This function fully expands all currently visible threads (not just one click) by
 * iterating until no more expandable buttons are found.
 */
async function expandAndSaveReplies(
  savedCommentIds: Set<string>,
  allComments: ScrapedComment[],
  cumulativeStats: ScrapeStats,
  onProgress?: (stats: ScrapeStats) => void,
): Promise<void> {
  log(`[Tokative] >>> expandAndSaveReplies START`);
  let totalExpanded = 0;
  const processedThreads = new Set<Element>(); // Track which parent comments we've fully expanded

  try {
    // Find all parent comment containers - filter to visible ones only
    // TikTok's virtualized list keeps many recycled DOM elements
    const allParentComments = querySelectorAll(
      ['[class*="DivCommentObjectWrapper"]'],
    );
    const parentComments = allParentComments.filter((el) => isVisible(el));
    log(
      `[Tokative] Found ${parentComments.length} visible parent comments (${allParentComments.length} total in DOM)`,
    );

    for (const parentComment of parentComments) {
      if (isCancelled) break;
      if (processedThreads.has(parentComment)) continue;

      // Fully expand this thread by clicking "View X replies" / "View X more" until done
      const config = getLoadedConfig();
      let threadClicks = 0;
      const maxClicksPerThread = config.limits.maxClicksPerThread;
      let consecutiveNoNewReplies = 0; // Track clicks that didn't yield new replies

      while (!isCancelled && threadClicks < maxClicksPerThread) {
        await waitWhilePaused();

        // Find the expand button within THIS parent comment
        const button = parentComment.querySelector(
          '[class*="DivViewRepliesContainer"]',
        ) as HTMLElement | null;
        if (!button) break;

        // Skip if button isn't visible (recycled element)
        if (!isVisible(button)) break;

        const text = button.textContent?.toLowerCase() || "";

        // If it says "Hide" or doesn't say "view", this thread is fully expanded
        if (text.includes("hide") || !text.includes("view")) {
          break;
        }

        // Click to expand more replies
        log(`[Tokative] Expanding thread: "${button.textContent?.trim()}"`);
        button.scrollIntoView({ behavior: "instant", block: "center" });
        await humanDelay("short");
        button.click();
        totalExpanded++;
        threadClicks++;

        // Wait for replies to load
        await waitForReplyLoad(button);

        // Extract and save new replies after each click
        const rawComments = await scrapeCommentsFromCurrentVideo();
        const newReplies: ScrapedComment[] = [];

        for (const raw of rawComments) {
          const scraped = rawCommentToScrapedComment(raw);
          if (scraped && !savedCommentIds.has(scraped.id)) {
            newReplies.push(scraped);
            savedCommentIds.add(scraped.id);
            allComments.push(scraped); // Add to main array for accurate progress
          }
        }

        cumulativeStats.found += newReplies.length;

        if (newReplies.length > 0) {
          const result = await addScrapedComments(newReplies);
          cumulativeStats.new += result.new;
          cumulativeStats.preexisting += result.preexisting;
          cumulativeStats.ignored += result.ignored;
          log(
            `[Tokative] Replies: +${result.new} new, ${result.preexisting} preexisting, ${result.ignored} ignored`,
          );
          consecutiveNoNewReplies = 0; // Reset counter
          // Report progress during reply expansion
          onProgress?.(cumulativeStats);
        } else {
          consecutiveNoNewReplies++;
          // If we've clicked N times without getting new replies, this thread is stuck
          if (consecutiveNoNewReplies >= config.limits.consecutiveNoReplies) {
            log(
              `[Tokative] Thread stuck after ${consecutiveNoNewReplies} clicks with no new replies, moving on`,
            );
            break;
          }
        }

        // Delay to avoid rate limiting
        await humanDelay("medium");
      }

      processedThreads.add(parentComment);

      if (threadClicks > 0) {
        log(`[Tokative] Thread fully expanded after ${threadClicks} clicks`);
      }
    }
  } catch (error) {
    console.error(`[Tokative] Error in expandAndSaveReplies:`, error);
  }

  log(
    `[Tokative] >>> expandAndSaveReplies END - expanded ${totalExpanded} buttons`,
  );
}

async function waitForReplyLoad(clickedButton: HTMLElement): Promise<void> {
  const config = getLoadedConfig();
  const initialText = clickedButton.textContent?.toLowerCase() || "";
  const maxWaitTime = config.timeouts.commentPost;
  const pollInterval = 200; // Slower polling
  let waited = 0;

  // Get initial reply count in the parent thread
  const replyContainer = clickedButton
    .closest('[class*="DivCommentObjectWrapper"]')
    ?.querySelector('[class*="DivReplyContainer"]');
  const initialReplyCount =
    replyContainer?.querySelectorAll('[class*="DivCommentItemWrapper"]')
      .length || 0;

  while (waited < maxWaitTime) {
    if (isCancelled) return;

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    waited += pollInterval;

    if (isCancelled) return;

    // Check if button text changed (expanded or showing "more")
    const currentText = clickedButton.textContent?.toLowerCase() || "";
    if (currentText !== initialText) {
      log(
        `[Tokative] Button text changed: "${initialText}" -> "${currentText}"`,
      );
      await humanDelay("medium");
      return;
    }

    // Check if new replies appeared
    const currentReplyCount =
      replyContainer?.querySelectorAll('[class*="DivCommentItemWrapper"]')
        .length || 0;
    if (currentReplyCount > initialReplyCount) {
      log(
        `[Tokative] Reply count increased: ${initialReplyCount} -> ${currentReplyCount}`,
      );
      await humanDelay("medium");
      return;
    }

    // Check if button is no longer in DOM (replaced by different structure)
    if (!document.contains(clickedButton)) {
      log(`[Tokative] Button removed from DOM`);
      await humanDelay("medium");
      return;
    }
  }

  log(`[Tokative] Timeout waiting for replies to load (waited ${waited}ms)`);
}

interface ScrollResult {
  lastCommentId: string | null;
  commentCount: number;
  hasNewContent: boolean;
  skeletonsAppeared: boolean;
}

/**
 * Checks if skeleton loaders are present in the scroller, indicating content is loading.
 * TikTok uses TUXSkeletonRectangle class for placeholder loading UI.
 */
function hasSkeletonLoaders(scroller: Element): boolean {
  return scroller.querySelector(".TUXSkeletonRectangle") !== null;
}

/**
 * Uses MutationObserver to detect skeleton loaders, even if they appear and disappear quickly.
 * Returns true if skeletons were observed at any point, false if none appeared within timeout.
 */
async function waitForSkeletonsToDisappear(
  scroller: Element,
  timeout?: number,
): Promise<boolean> {
  const config = getLoadedConfig();
  const timeoutMs = timeout ?? config.timeouts.skeletonLoader;
  const startTime = Date.now();
  const initialHasSkeletons = hasSkeletonLoaders(scroller);
  log(`[Tokative] [SKEL] Start: initialHasSkeletons=${initialHasSkeletons}, timeout=${timeoutMs}ms`);

  return new Promise((resolve) => {
    let sawSkeletons = initialHasSkeletons;
    let resolved = false;
    let mutationCount = 0;

    const cleanup = (result: boolean, reason: string) => {
      if (resolved) return;
      resolved = true;
      observer.disconnect();
      const elapsed = Date.now() - startTime;
      log(`[Tokative] [SKEL] Done: sawSkeletons=${result}, reason=${reason}, elapsed=${elapsed}ms, mutations=${mutationCount}`);
      resolve(result);
    };

    const observer = new MutationObserver(() => {
      mutationCount++;
      const hasNow = hasSkeletonLoaders(scroller);
      if (hasNow) {
        if (!sawSkeletons) {
          log(`[Tokative] [SKEL] Detected via observer after ${Date.now() - startTime}ms`);
        }
        sawSkeletons = true;
      } else if (sawSkeletons) {
        cleanup(true, "skeletons_disappeared");
      }
    });

    observer.observe(scroller, { childList: true, subtree: true });

    setTimeout(() => {
      cleanup(sawSkeletons, sawSkeletons ? "timeout_with_skeletons" : "timeout_no_skeletons");
    }, timeoutMs);
  });
}

async function scrollAndWaitForContent(
  scroller: Element,
  prevLastCommentId: string | null,
  prevCommentCount: number,
): Promise<ScrollResult> {
  const scrollTopBefore = scroller.scrollTop;
  const clientHeight = scroller.clientHeight;
  const scrollHeightBefore = scroller.scrollHeight;

  // Check if we're already at the bottom before scrolling
  const wasAtBottom = scrollTopBefore + clientHeight >= scrollHeightBefore - 10;

  log(
    `[Tokative] scrollAndWait: before scroll - top=${scrollTopBefore}, height=${scrollHeightBefore}, wasAtBottom=${wasAtBottom}, prevLastId=${prevLastCommentId}, prevCount=${prevCommentCount}`,
  );

  // If we're already at the bottom, scroll UP first to create movement
  // This triggers TikTok's lazy loading which requires actual scroll movement
  const config = getLoadedConfig();
  if (wasAtBottom) {
    const scrollUpAmount = Math.min(500, scrollTopBefore);
    scroller.scrollTop = scrollTopBefore - scrollUpAmount;
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, config.delays.scrollUp));
    log(`[Tokative] Was at bottom, scrolled up to ${scroller.scrollTop}`);
  }

  // Scroll to bottom using scrollBy for more natural behavior
  const currentPos = scroller.scrollTop;
  const targetPos = scroller.scrollHeight;
  const scrollAmount = targetPos - currentPos;

  if (scrollAmount > 0) {
    const chunkSize = Math.min(scrollAmount, 800);
    scroller.scrollBy({ top: chunkSize, behavior: "instant" });
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (scrollAmount > chunkSize) {
      scroller.scrollTop = targetPos;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
  } else {
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
  }

  // Wait a moment for TikTok to show skeleton loaders
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Wait for skeletons to appear and disappear (indicates loading)
  const skeletonsAppeared = await waitForSkeletonsToDisappear(scroller);

  // If no skeletons appeared, wait a fallback timeout for any delayed content
  if (!skeletonsAppeared) {
    log(`[Tokative] No skeletons detected, waiting fallback ${config.delays.fallbackContent}ms`);
    await new Promise((resolve) => setTimeout(resolve, config.delays.fallbackContent));
  }

  if (isCancelled) {
    log(`[Tokative] Cancelled during scroll wait`);
    return {
      lastCommentId: prevLastCommentId,
      commentCount: prevCommentCount,
      hasNewContent: false,
      skeletonsAppeared,
    };
  }

  // Extract current React data to compare with previous state
  const reactDataAfter = await extractAllReactData();
  const commentsAfter = Array.from(reactDataAfter.values()).filter((r) => r.cid);
  const countAfter = commentsAfter.length;
  const lastIdAfter = commentsAfter.length > 0 ? commentsAfter[commentsAfter.length - 1].cid : null;

  // Determine if new content was loaded by comparing last comment ID and count
  const idChanged = lastIdAfter !== prevLastCommentId;
  const countChanged = countAfter !== prevCommentCount;
  const hasNewContent = idChanged || countChanged;

  log(
    `[Tokative] scrollAndWait complete: skeletons=${skeletonsAppeared}, lastId=${prevLastCommentId}->${lastIdAfter}, count=${prevCommentCount}->${countAfter}, hasNewContent=${hasNewContent}`,
  );

  return {
    lastCommentId: lastIdAfter,
    commentCount: countAfter,
    hasNewContent,
    skeletonsAppeared,
  };
}

interface ScrapeResult {
  comments: ScrapedComment[];
  stats: ScrapeStats;
}

async function scrollToLoadComments(
  maxComments: number,
  onProgress?: (stats: ScrapeStats) => void,
): Promise<ScrapeResult> {
  log("[Tokative] scrollToLoadComments called, maxComments:", maxComments);

  const scroller = querySelector(VIDEO_SELECTORS.commentsScroller);
  log("[Tokative] Scroller element found:", !!scroller);
  if (scroller) {
    log("[Tokative] Scroller details:", {
      className: scroller.className,
      tagName: scroller.tagName,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      scrollTop: scroller.scrollTop,
    });
  }
  if (!scroller) {
    log(
      "[Tokative] No scroller found, trying all selectors:",
      VIDEO_SELECTORS.commentsScroller,
    );
    // Debug: list all potential scrollers
    const allDivs = document.querySelectorAll('[class*="Comment"]');
    log("[Tokative] Elements with 'Comment' in class:", allDivs.length);
    allDivs.forEach((div, i) => {
      if (i < 5)
        log(`  [${i}] ${div.tagName}.${div.className.substring(0, 60)}`);
    });
    return {
      comments: [],
      stats: { found: 0, new: 0, preexisting: 0, ignored: 0 },
    };
  }

  let loopIteration = 0;
  let exitReason = "unknown";
  const allComments: ScrapedComment[] = [];
  const savedCommentIds = new Set<string>();
  let lastIterationTime = Date.now();

  // Track last comment ID and count for end detection
  let lastCommentId: string | null = null;
  let lastCommentCount = 0;

  // Track cumulative stats
  const cumulativeStats: ScrapeStats = {
    found: 0,
    new: 0,
    preexisting: 0,
    ignored: 0,
  };

  while (!isCancelled) {
    loopIteration++;
    const now = Date.now();
    const timeSinceLastIteration = now - lastIterationTime;
    lastIterationTime = now;
    const countBefore = allComments.length;
    log(
      `[Tokative] === Scroll loop iteration ${loopIteration} === (${timeSinceLastIteration}ms since last)`,
    );

    await waitWhilePaused();
    if (isCancelled) {
      log("[Tokative] Scrape cancelled, exiting loop");
      exitReason = "cancelled";
      break;
    }

    const commentElements = querySelectorAll(VIDEO_SELECTORS.commentItem);
    log(
      `[Tokative] Found ${commentElements.length} comment elements, saved comments: ${allComments.length}`,
    );

    // Check against actual saved comments, not DOM elements (which may include replies)
    if (maxComments !== Infinity && allComments.length >= maxComments) {
      log(
        `[Tokative] Reached maxComments limit (${allComments.length} >= ${maxComments}), breaking`,
      );
      exitReason = `maxComments reached (${maxComments})`;
      break;
    }

    // Always extract comments from current DOM
    const rawComments = await scrapeCommentsFromCurrentVideo();
    log(
      `[Tokative] Extracted ${rawComments.length} raw comments from React data`,
    );
    const newComments: ScrapedComment[] = [];

    // Calculate how many more comments we can add
    const remainingBudget =
      maxComments === Infinity ? Infinity : maxComments - allComments.length;

    for (const raw of rawComments) {
      // Stop if we've used up our budget
      if (
        remainingBudget !== Infinity &&
        newComments.length >= remainingBudget
      ) {
        break;
      }

      const scraped = rawCommentToScrapedComment(raw);
      if (scraped && !savedCommentIds.has(scraped.id)) {
        newComments.push(scraped);
        savedCommentIds.add(scraped.id);
        allComments.push(scraped);
      }
    }

    log(
      `[Tokative] New unique comments this iteration: ${newComments.length}, total: ${allComments.length}/${maxComments}`,
    );

    // Track found count (before storage dedup)
    cumulativeStats.found += newComments.length;

    if (newComments.length > 0) {
      const result = await addScrapedComments(newComments);
      cumulativeStats.new += result.new;
      cumulativeStats.preexisting += result.preexisting;
      cumulativeStats.ignored += result.ignored;
      log(
        `[Tokative] Storage result: +${result.new} new, ${result.preexisting} preexisting, ${result.ignored} ignored (totals: ${cumulativeStats.new}/${cumulativeStats.found})`,
      );
      // Report progress immediately after main comments (before potentially slow reply expansion)
      onProgress?.(cumulativeStats);
    }

    // Always try to expand reply threads and save replies incrementally
    // This ensures we capture replies before TikTok recycles DOM elements
    const expandButtons = querySelectorAll<HTMLElement>(
      VIDEO_SELECTORS.viewRepliesButton,
    );
    const viewButtons = expandButtons.filter((b) => {
      const text = b.textContent?.toLowerCase() || "";
      return text.includes("view") && !text.includes("hide");
    });

    if (viewButtons.length > 0) {
      log(`[Tokative] Found ${viewButtons.length} expandable reply buttons`);
      await expandAndSaveReplies(
        savedCommentIds,
        allComments,
        cumulativeStats,
        onProgress,
      );
      log(
        `[Tokative] Total comments after expansion: ${allComments.length}, stats: ${JSON.stringify(cumulativeStats)}`,
      );
    }

    // Report stats (always, not just when expanding replies)
    log(`[Tokative] Reporting progress: ${JSON.stringify(cumulativeStats)}`);
    try {
      onProgress?.(cumulativeStats);
      log(`[Tokative] onProgress called successfully`);
    } catch (err) {
      console.error(`[Tokative] Error calling onProgress:`, err);
    }

    // Scroll down and wait for new content to load
    const scrollResult = await scrollAndWaitForContent(
      scroller,
      lastCommentId,
      lastCommentCount,
    );

    // Update tracked state for next iteration
    lastCommentId = scrollResult.lastCommentId;
    lastCommentCount = scrollResult.commentCount;

    const addedThisIteration = allComments.length - countBefore;
    log(
      `[Tokative] Iteration ${loopIteration} summary: added=${addedThisIteration}, hasNewContent=${scrollResult.hasNewContent}, skeletons=${scrollResult.skeletonsAppeared}, lastId=${lastCommentId}, count=${lastCommentCount}`,
    );

    // Stop if skeletons appeared but no new content loaded (we've reached the end)
    if (scrollResult.skeletonsAppeared && !scrollResult.hasNewContent) {
      log(
        "[Tokative] Skeletons appeared but no new content - reached end of comments",
      );
      exitReason = "end of content (no new data after skeletons)";
      break;
    }

    // Also stop if no skeletons and no new content (fallback for edge cases)
    if (!scrollResult.skeletonsAppeared && !scrollResult.hasNewContent && addedThisIteration === 0) {
      log(
        "[Tokative] No skeletons, no new content, no new comments - likely at end",
      );
      exitReason = "end of content (no activity)";
      break;
    }

    // Small delay between iterations to avoid hammering
    await humanDelay("micro");
  }

  log(`[Tokative] ====== Scroll loop finished ======`);
  log(`[Tokative] Total iterations: ${loopIteration}`);
  log(
    `[Tokative] Final DOM elements: ${querySelectorAll(VIDEO_SELECTORS.commentItem).length}`,
  );
  log(`[Tokative] Total unique comments collected: ${allComments.length}`);
  log(`[Tokative] Final stats: ${JSON.stringify(cumulativeStats)}`);
  log(`[Tokative] Exit reason: ${exitReason}`);

  // Final pass: expand any remaining visible threads and save
  // (Most expansion happens during scroll, this catches any stragglers)
  if (!isCancelled) {
    log(`[Tokative] === FINAL PASS ===`);
    const preCount = allComments.length;
    await expandAndSaveReplies(
      savedCommentIds,
      allComments,
      cumulativeStats,
      onProgress,
    );
    const addedCount = allComments.length - preCount;

    if (addedCount > 0) {
      log(`[Tokative] Final pass found ${addedCount} additional comments`);
    }

    onProgress?.(cumulativeStats);
  }

  // Truncate to exact limit if we collected more than requested
  if (maxComments !== Infinity && allComments.length > maxComments) {
    log(
      `[Tokative] Truncating from ${allComments.length} to ${maxComments} comments`,
    );
    return {
      comments: allComments.slice(0, maxComments),
      stats: cumulativeStats,
    };
  }

  return { comments: allComments, stats: cumulativeStats };
}

async function waitForCommentContent(
  options: { timeout?: number } = {},
): Promise<boolean> {
  const config = getLoadedConfig();
  const { timeout = config.timeouts.commentLoadWait } = options;
  const startTime = Date.now();
  const pollInterval = 200;

  while (Date.now() - startTime < timeout) {
    if (isCancelled) return false;

    const commentItems = querySelectorAll(VIDEO_SELECTORS.commentItem);
    for (const item of commentItems) {
      const usernameEl = querySelector(VIDEO_SELECTORS.commentUsername, item);
      if (usernameEl && usernameEl.textContent?.trim()) {
        return true;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return false;
}

async function openCommentsPanel(): Promise<boolean> {
  log("[Tokative] openCommentsPanel called");
  const existingComments = querySelector(VIDEO_SELECTORS.commentsContainer);
  log("[Tokative] Existing comments panel:", !!existingComments);
  if (existingComments) {
    return true;
  }

  log(
    "[Tokative] Looking for comment button with selectors:",
    VIDEO_SELECTORS.commentButton,
  );
  const commentButton = querySelector<HTMLElement>(
    VIDEO_SELECTORS.commentButton,
  );
  log("[Tokative] Comment button found:", !!commentButton);
  if (!commentButton) {
    log("[Tokative] Waiting for comment button...");
    const button = await waitForSelector(VIDEO_SELECTORS.commentButton, {
      timeout: 10000,
    });
    log("[Tokative] Comment button after wait:", !!button);
    if (!button) {
      log("[Tokative] ERROR: Comment button not found after 10s timeout");
      return false;
    }
    log("[Tokative] Clicking comment button (waited)");
    (button as HTMLElement).click();
  } else {
    log("[Tokative] Clicking comment button (immediate)");
    commentButton.click();
  }

  await humanDelay("short");

  log("[Tokative] Waiting for comments panel to appear...");
  const commentsPanel = await waitForSelector(
    VIDEO_SELECTORS.commentsContainer,
    { timeout: 10000 },
  );
  log("[Tokative] Comments panel found:", !!commentsPanel);
  return commentsPanel !== null;
}

function extractThumbnailFromVideoItem(videoItem: Element): string | null {
  const img = videoItem.querySelector("img");
  if (img) {
    // Check various attributes TikTok might use for lazy loading
    const src = img.src;
    const dataSrc = img.getAttribute("data-src");
    const srcset = img.getAttribute("srcset");

    // Prefer actual src if it's a real URL (not a data URL or placeholder)
    if (src && src.startsWith("http") && !src.includes("data:")) {
      return src;
    }

    // Check data-src for lazy-loaded images
    if (dataSrc && dataSrc.startsWith("http")) {
      return dataSrc;
    }

    // Check srcset
    if (srcset) {
      const firstUrl = srcset.split(",")[0]?.split(" ")[0];
      if (firstUrl && firstUrl.startsWith("http")) {
        return firstUrl;
      }
    }
  }

  // Check picture element with source
  const picture = videoItem.querySelector("picture source");
  if (picture) {
    const srcset = picture.getAttribute("srcset");
    if (srcset) {
      const firstUrl = srcset.split(",")[0]?.split(" ")[0];
      if (firstUrl && firstUrl.startsWith("http")) {
        return firstUrl;
      }
    }
  }

  // Check for background-image style
  const divWithBg = videoItem.querySelector('[style*="background-image"]');
  if (divWithBg) {
    const style = divWithBg.getAttribute("style");
    const match = style?.match(
      /background-image:\s*url\(["']?([^"')]+)["']?\)/,
    );
    if (match && match[1] && match[1].startsWith("http")) {
      return match[1];
    }
  }

  return null;
}

async function waitForThumbnailToLoad(
  videoItem: Element,
  timeout?: number,
): Promise<string | null> {
  const config = getLoadedConfig();
  const timeoutMs = timeout ?? config.timeouts.thumbnailLoad;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const thumbnail = extractThumbnailFromVideoItem(videoItem);
    if (thumbnail) {
      return thumbnail;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

function extractVideoIdFromVideoItem(videoItem: Element): string | null {
  const link = videoItem.querySelector("a[href*='/video/']");
  if (link) {
    const href = link.getAttribute("href");
    if (href) {
      const match = href.match(/\/video\/(\d+)/);
      if (match) return match[1];
    }
  }
  return null;
}

async function closeVideoModal(): Promise<void> {
  const config = getLoadedConfig();
  log("[Tokative] Closing modal with history.back()");
  window.history.back();

  // Wait for the video grid to reappear (confirms we're back on profile)
  const grid = await waitForSelector(VIDEO_SELECTORS.videoGrid, {
    timeout: config.timeouts.modalClose,
  });
  if (grid) {
    log("[Tokative] Back on profile page, video grid found");
  } else {
    log("[Tokative] Warning: video grid not found after going back");
  }

  await humanDelay("short");
}

async function clickVideoItem(videoItem: Element): Promise<boolean> {
  const clickTarget = videoItem.querySelector("a") as HTMLElement | null;
  if (!clickTarget) return false;

  // Push current URL to history before clicking, so history.back() has somewhere to go
  const currentUrl = window.location.href;
  window.history.pushState({ tiktokBuddy: true }, "", currentUrl);
  log("[Tokative] Pushed history state before clicking video");

  clickTarget.click();
  await humanDelayWithJitter("medium");

  const modal = await waitForSelector(VIDEO_SELECTORS.videoModal, {
    timeout: 5000,
  });
  return modal !== null;
}

export async function scrapeProfileVideos(
  maxVideos: number = Infinity,
  maxCommentsPerVideo: number = Infinity,
  onProgress?: (progress: VideoScrapeProgress) => void,
): Promise<ScrapedComment[]> {
  isCancelled = false;
  const allComments: ScrapedComment[] = [];
  const videoThumbnails = new Map<string, string>();

  log("[Tokative] Starting profile scrape");

  const videoGrid = querySelector(VIDEO_SELECTORS.videoGrid);
  if (!videoGrid) {
    log("[Tokative] No video grid found");
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 0,
      commentsFound: 0,
      status: "error",
      message: "No video grid found. Are you on a profile page?",
    });
    return [];
  }

  const videoItems = querySelectorAll(VIDEO_SELECTORS.videoItem);
  const videosToProcess = Math.min(videoItems.length, maxVideos);

  log(
    `[Tokative] Found ${videoItems.length} videos, will process ${videosToProcess}`,
  );

  onProgress?.({
    videosProcessed: 0,
    totalVideos: videosToProcess,
    commentsFound: 0,
    status: "loading",
    message: `Found ${videoItems.length} videos, will process ${videosToProcess}`,
  });

  for (let i = 0; i < videosToProcess && !isCancelled; i++) {
    try {
      const videoItem = videoItems[i];
      const thumbnail = extractThumbnailFromVideoItem(videoItem);
      const videoId = extractVideoIdFromVideoItem(videoItem);

      log(
        `[Tokative] Processing video ${i + 1}: ${videoId}, thumbnail: ${thumbnail ? "yes" : "no"}`,
      );

      if (videoId && thumbnail) {
        videoThumbnails.set(videoId, thumbnail);
      }

      onProgress?.({
        videosProcessed: i,
        totalVideos: videosToProcess,
        commentsFound: allComments.length,
        status: "scraping",
        message: `Opening video ${i + 1} of ${videosToProcess}...`,
      });

      const modalOpened = await clickVideoItem(videoItem);
      if (!modalOpened) {
        log(`[Tokative] Failed to open modal for video ${i + 1}`);
        continue;
      }

      log(`[Tokative] Modal opened for video ${i + 1}`);
      await humanDelay("short");

      const result = await scrapeVideoComments(
        maxCommentsPerVideo,
        (progress) => {
          onProgress?.({
            videosProcessed: i,
            totalVideos: videosToProcess,
            commentsFound: allComments.length + progress.commentsFound,
            status: "scraping",
            message: `Video ${i + 1}/${videosToProcess}: ${progress.message}`,
          });
        },
      );

      log(
        `[Tokative] Scraped ${result.comments.length} comments from video ${i + 1}`,
      );

      // Just track locally - saving already happened incrementally during scroll
      for (const comment of result.comments) {
        allComments.push(comment);
      }

      log(`[Tokative] Closing modal for video ${i + 1}`);
      await closeVideoModal();
      await humanDelayWithJitter("long");
    } catch (error) {
      console.error(`[Tokative] Error processing video ${i + 1}:`, error);
      // Try to close any open modal and continue
      try {
        await closeVideoModal();
      } catch {
        // Ignore close errors
      }
      await humanDelayWithJitter("long");
    }
  }

  if (isCancelled) {
    log("[Tokative] Scraping cancelled");
    onProgress?.({
      videosProcessed: 0,
      totalVideos: videosToProcess,
      commentsFound: allComments.length,
      status: "cancelled",
      message: "Scraping cancelled",
    });
    return allComments;
  }

  log(
    `[Tokative] Scraping complete: ${allComments.length} comments from ${videosToProcess} videos`,
  );
  onProgress?.({
    videosProcessed: videosToProcess,
    totalVideos: videosToProcess,
    commentsFound: allComments.length,
    status: "complete",
    message: `Scraped ${allComments.length} comments from ${videosToProcess} videos`,
  });

  return allComments;
}

function getProfileHandleFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/@([^/?]+)/);
  return match ? match[1] : null;
}

export async function scrapeProfileVideoMetadata(
  maxVideos: number = Infinity,
  onProgress?: (progress: VideoMetadataScrapeProgress) => void,
): Promise<{ videos: ScrapedVideo[]; limitReached: boolean }> {
  isCancelled = false;
  const allVideos: ScrapedVideo[] = [];
  const seenVideoIds = new Set<string>();

  const profileHandle = getProfileHandleFromUrl();
  if (!profileHandle) {
    onProgress?.({
      videosFound: 0,
      status: "error",
      message: "Not on a profile page. Navigate to a TikTok profile first.",
    });
    return { videos: [], limitReached: false };
  }

  log(
    "[Tokative] Starting video metadata scrape for @" +
      profileHandle +
      " (max: " +
      maxVideos +
      ")",
  );

  onProgress?.({
    videosFound: 0,
    status: "scrolling",
    message: "Looking for video grid...",
  });

  const videoGrid = await waitForSelector(VIDEO_SELECTORS.videoGrid, {
    timeout: 10000,
  });
  if (!videoGrid) {
    onProgress?.({
      videosFound: 0,
      status: "error",
      message: "No video grid found. Are you on a profile page?",
    });
    return { videos: [], limitReached: false };
  }

  let lastCount = 0;
  let stableIterations = 0;

  while (!isCancelled) {
    const videoItems = querySelectorAll(VIDEO_SELECTORS.videoItem);

    onProgress?.({
      videosFound: allVideos.length,
      status: "scrolling",
      message: `Found ${allVideos.length} posts${maxVideos !== Infinity ? ` (max ${maxVideos})` : ""}, scrolling for more...`,
    });

    for (let i = 0; i < videoItems.length; i++) {
      if (allVideos.length >= maxVideos) break;

      const item = videoItems[i];
      const videoId = extractVideoIdFromVideoItem(item);
      if (!videoId || seenVideoIds.has(videoId)) continue;

      seenVideoIds.add(videoId);

      // Scroll item into view to trigger lazy loading of thumbnail
      item.scrollIntoView({ block: "center", behavior: "instant" });

      // Wait for thumbnail to actually load (up to 2 seconds)
      const thumbnail = await waitForThumbnailToLoad(item, 2000);
      const video: ScrapedVideo = {
        id: `${profileHandle}-${videoId}`,
        videoId,
        thumbnailUrl: thumbnail || "",
        videoUrl: `https://www.tiktok.com/@${profileHandle}/video/${videoId}`,
        profileHandle,
        order: allVideos.length,
        scrapedAt: new Date().toISOString(),
      };

      allVideos.push(video);
    }

    if (allVideos.length >= maxVideos) {
      break;
    }

    const config = getLoadedConfig();
    if (videoItems.length === lastCount) {
      stableIterations++;
      if (stableIterations >= config.limits.stableIterationsRequired) {
        break;
      }
    } else {
      stableIterations = 0;
      lastCount = videoItems.length;

      if (allVideos.length > 0 && allVideos.length % 10 === 0) {
        const savedCount = await addVideos(allVideos);
        log(`[Tokative] Incrementally saved ${savedCount} new videos`);
      }
    }

    window.scrollTo(0, document.body.scrollHeight);
    await humanDelayWithJitter("medium");
  }

  if (isCancelled) {
    onProgress?.({
      videosFound: allVideos.length,
      status: "cancelled",
      message: "Scraping cancelled",
    });
    return { videos: allVideos, limitReached: false };
  } else {
    const savedCount = await addVideos(allVideos);
    log(`[Tokative] Final save: ${savedCount} new videos`);

    const limitReached = allVideos.length >= maxVideos;
    onProgress?.({
      videosFound: allVideos.length,
      status: "complete",
      message: `Scraped ${allVideos.length} posts from @${profileHandle}`,
      limitReached,
    });
    return { videos: allVideos, limitReached };
  }
}

export interface ScrapeCommentsResult {
  comments: ScrapedComment[];
  stats: ScrapeStats;
}

export async function scrapeVideoComments(
  maxComments: number = Infinity,
  onProgress?: (progress: VideoScrapeProgress) => void,
): Promise<ScrapeCommentsResult> {
  log(
    "[Tokative] scrapeVideoComments called, maxComments:",
    maxComments,
    "onProgress defined:",
    !!onProgress,
  );
  isCancelled = false;

  // Capture displayed comment count before we start scrolling
  const displayedCount = getDisplayedCommentCount();

  onProgress?.({
    videosProcessed: 0,
    totalVideos: 1,
    commentsFound: 0,
    status: "loading",
    message: "Opening comments panel...",
  });

  log("[Tokative] Opening comments panel...");
  const panelOpened = await openCommentsPanel();
  log("[Tokative] Panel opened:", panelOpened);
  if (!panelOpened) {
    log("[Tokative] ERROR: Could not open comments panel");
    const emptyStats = { found: 0, new: 0, preexisting: 0, ignored: 0 };
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: 0,
      status: "error",
      message: "Could not open comments panel",
      stats: emptyStats,
    });
    return { comments: [], stats: emptyStats };
  }

  onProgress?.({
    videosProcessed: 0,
    totalVideos: 1,
    commentsFound: 0,
    status: "loading",
    message: "Loading comments...",
  });

  log("[Tokative] Waiting for comment items...");
  await waitForSelector(VIDEO_SELECTORS.commentItem, { timeout: 10000 });
  log("[Tokative] Comment items selector found");

  log("[Tokative] Waiting for comment content...");
  const contentLoaded = await waitForCommentContent({ timeout: 10000 });
  log("[Tokative] Comment content loaded:", contentLoaded);
  if (!contentLoaded) {
    log("[Tokative] ERROR: Comments failed to load");
    const emptyStats = { found: 0, new: 0, preexisting: 0, ignored: 0 };
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: 0,
      status: "error",
      message: "Comments failed to load",
      stats: emptyStats,
    });
    return { comments: [], stats: emptyStats };
  }

  log("[Tokative] Starting scroll loop...");
  // scrollToLoadComments now handles extraction and saving incrementally
  const result = await scrollToLoadComments(maxComments, (stats) => {
    log(
      "[Tokative] scrollToLoadComments callback invoked with stats:",
      JSON.stringify(stats),
    );
    const progress = {
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: stats.found,
      status: "scraping" as const,
      message: `Found ${stats.found}, new ${stats.new}`,
      stats,
    };
    log("[Tokative] Calling onProgress with:", JSON.stringify(progress));
    onProgress?.(progress);
  });
  log(
    "[Tokative] Scroll loop completed, comments:",
    result.comments.length,
    "stats:",
    result.stats,
  );

  // Build and log diagnostic summary
  const topLevelComments = result.comments.filter((c) => !c.parentCommentId);
  const replyComments = result.comments.filter((c) => !!c.parentCommentId);

  // Find incomplete threads - where we got fewer replies than expected
  const incompleteThreads: Array<{ parentId: string; expected: number; got: number }> = [];
  for (const comment of topLevelComments) {
    if (comment.replyCount && comment.replyCount > 0) {
      const actualReplies = replyComments.filter((r) => r.parentCommentId === comment.id).length;
      if (actualReplies < comment.replyCount) {
        incompleteThreads.push({
          parentId: comment.id,
          expected: comment.replyCount,
          got: actualReplies,
        });
      }
    }
  }

  const diagnostics: DiagnosticData = {
    displayedCount,
    scrapedTotal: result.comments.length,
    topLevelCount: topLevelComments.length,
    replyCount: replyComments.length,
    incompleteThreads,
  };

  logDiagnosticSummary(diagnostics, result.comments);

  if (isCancelled) {
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: result.stats.found,
      status: "cancelled",
      message: `Cancelled: ${result.stats.new} new, ${result.stats.ignored} ignored, ${result.stats.preexisting} preexisting`,
      stats: result.stats,
    });
    return result;
  }

  onProgress?.({
    videosProcessed: 1,
    totalVideos: 1,
    commentsFound: result.stats.found,
    status: "complete",
    message: `Done: ${result.stats.new} new, ${result.stats.ignored} ignored, ${result.stats.preexisting} preexisting`,
    stats: result.stats,
  });

  return result;
}
