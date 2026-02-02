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
import { VIDEO_SELECTORS } from "./video-selectors";

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

  // Wait for the extraction to complete - 500ms to allow React to settle
  await new Promise((resolve) => setTimeout(resolve, 500));

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

    const comment: RawCommentData = {
      commentId,
      tiktokUserId: reactData.user?.uid || "",
      handle: reactData.user?.unique_id || "",
      displayName: reactData.user?.nickname || reactData.user?.unique_id || "",
      comment: reactData.text || "",
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

      return rawCommentToScrapedComment(rawComment);
    }
  }

  log(`[Tokative] findRecentlyPostedReply: no matching reply found`);
  return null;
}

export async function findRecentlyPostedReplyWithRetry(
  options: FindReplyOptions,
  maxRetries: number = 3,
  retryDelayMs: number = 1000,
): Promise<ScrapedComment | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(`[Tokative] findRecentlyPostedReplyWithRetry: attempt ${attempt}/${maxRetries}`);
    const result = await findRecentlyPostedReply(options);
    if (result) {
      return result;
    }
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
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
      '[class*="DivCommentObjectWrapper"]',
    );
    const parentComments = allParentComments.filter((el) => isVisible(el));
    log(
      `[Tokative] Found ${parentComments.length} visible parent comments (${allParentComments.length} total in DOM)`,
    );

    for (const parentComment of parentComments) {
      if (isCancelled) break;
      if (processedThreads.has(parentComment)) continue;

      // Fully expand this thread by clicking "View X replies" / "View X more" until done
      let threadClicks = 0;
      const maxClicksPerThread = 20; // Safety limit per thread
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
          cumulativeStats.stored += result.stored;
          cumulativeStats.duplicates += result.duplicates;
          cumulativeStats.ignored += result.ignored;
          log(
            `[Tokative] Replies: +${result.stored} stored, ${result.duplicates} dupes, ${result.ignored} ignored`,
          );
          consecutiveNoNewReplies = 0; // Reset counter
          // Report progress during reply expansion
          onProgress?.(cumulativeStats);
        } else {
          consecutiveNoNewReplies++;
          // If we've clicked 3 times without getting new replies, this thread is stuck
          if (consecutiveNoNewReplies >= 3) {
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
  const initialText = clickedButton.textContent?.toLowerCase() || "";
  const maxWaitTime = 5000;
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
  scrollMoved: boolean;
  contentGrew: boolean;
  foundNewReactData: boolean;
}

/**
 * Checks if skeleton loaders are present in the scroller, indicating content is loading.
 * TikTok uses TUXSkeletonRectangle class for placeholder loading UI.
 */
function hasSkeletonLoaders(scroller: Element): boolean {
  return scroller.querySelector(".TUXSkeletonRectangle") !== null;
}

/**
 * Waits for skeleton loaders to disappear, indicating content has loaded.
 * Returns true if skeletons were found and disappeared, false if timeout or no skeletons.
 */
async function waitForSkeletonsToDisappear(
  scroller: Element,
  timeout: number = 5000,
): Promise<boolean> {
  const pollInterval = 100;
  let waited = 0;

  // First check if there are any skeletons
  if (!hasSkeletonLoaders(scroller)) {
    return false; // No skeletons found
  }

  log(`[Tokative] Skeleton loaders detected, waiting for them to disappear...`);

  while (waited < timeout) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    waited += pollInterval;

    if (!hasSkeletonLoaders(scroller)) {
      log(`[Tokative] Skeletons disappeared after ${waited}ms`);
      return true;
    }
  }

  log(`[Tokative] Skeletons still present after ${timeout}ms timeout`);
  return true; // Skeletons were present (even if they didn't disappear)
}

async function scrollAndWaitForContent(
  scroller: Element,
  knownCommentIds: Set<string>,
): Promise<ScrollResult> {
  const scrollHeightBefore = scroller.scrollHeight;
  const scrollTopBefore = scroller.scrollTop;
  const clientHeight = scroller.clientHeight;

  // Check if we're already at the bottom before scrolling
  const wasAtBottom = scrollTopBefore + clientHeight >= scrollHeightBefore - 10;

  // Get current React data comment IDs for comparison
  const reactDataBefore = await extractAllReactData();
  const reactIdsBefore = new Set(
    Array.from(reactDataBefore.values()).map((r) => r.cid),
  );
  const reactCountBefore = reactDataBefore.size;

  log(
    `[Tokative] scrollAndWait: before scroll - top=${scrollTopBefore}, height=${scrollHeightBefore}, wasAtBottom=${wasAtBottom}, reactCount=${reactCountBefore}`,
  );

  // If we're already at the bottom, scroll UP first to create movement
  // This triggers TikTok's lazy loading which requires actual scroll movement
  if (wasAtBottom) {
    const scrollUpAmount = Math.min(500, scrollTopBefore);
    scroller.scrollTop = scrollTopBefore - scrollUpAmount;
    // Dispatch scroll event to ensure TikTok's listeners are triggered
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    log(`[Tokative] Was at bottom, scrolled up to ${scroller.scrollTop}`);
  }

  // Now scroll to bottom using scrollBy for more natural behavior
  const currentPos = scroller.scrollTop;
  const targetPos = scroller.scrollHeight;
  const scrollAmount = targetPos - currentPos;

  if (scrollAmount > 0) {
    // Scroll in chunks to simulate more natural scrolling
    const chunkSize = Math.min(scrollAmount, 800);
    scroller.scrollBy({ top: chunkSize, behavior: "instant" });
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Scroll the rest if needed
    if (scrollAmount > chunkSize) {
      scroller.scrollTop = targetPos;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
  } else {
    // We're already at the target, but still dispatch scroll event
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
  }

  // Wait a moment for TikTok to show skeleton loaders (if loading more content)
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Check for skeleton loaders - their presence means content is loading
  const skeletonsAppeared = await waitForSkeletonsToDisappear(scroller, 5000);

  // Poll for changes with timeout
  const maxWaitTime = skeletonsAppeared ? 2000 : 5000; // Shorter wait if we already waited for skeletons
  const pollInterval = 300;
  let waited = 0;
  let scrollMoved = false;
  let contentGrew = false;
  let foundNewReactData = false;

  while (waited < maxWaitTime) {
    if (isCancelled) {
      log(`[Tokative] Cancelled during scroll wait`);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    waited += pollInterval;

    if (isCancelled) {
      log(`[Tokative] Cancelled during scroll wait`);
      break;
    }

    const scrollTopAfter = scroller.scrollTop;
    const scrollHeightAfter = scroller.scrollHeight;

    scrollMoved = Math.abs(scrollTopAfter - scrollTopBefore) > 5;
    contentGrew = scrollHeightAfter > scrollHeightBefore + 10;

    // Check if React data has new comments we haven't seen
    const reactDataAfter = await extractAllReactData();

    for (const [, data] of reactDataAfter) {
      if (
        data.cid &&
        !reactIdsBefore.has(data.cid) &&
        !knownCommentIds.has(data.cid)
      ) {
        foundNewReactData = true;
        break;
      }
    }

    // If we found new content, we're done waiting
    if (foundNewReactData || contentGrew) {
      log(
        `[Tokative] Found new content after ${waited}ms (skeletons=${skeletonsAppeared}): contentGrew=${contentGrew}, foundNewReactData=${foundNewReactData}`,
      );
      break;
    }

    // If skeletons appeared and disappeared but no new content yet, keep waiting briefly
    // If no skeletons appeared at all, we're likely at the end - exit sooner
    if (!skeletonsAppeared && waited >= 2000) {
      const atBottom = scrollTopAfter + clientHeight >= scrollHeightAfter - 10;
      if (atBottom && !scrollMoved && !contentGrew) {
        log(
          `[Tokative] No skeletons and at bottom after ${waited}ms - likely end of content`,
        );
        break;
      }
    }
  }

  const finalHeight = scroller.scrollHeight;
  const finalTop = scroller.scrollTop;
  log(
    `[Tokative] scrollAndWait complete: ${scrollTopBefore}->${finalTop}, height ${scrollHeightBefore}->${finalHeight}, moved=${scrollMoved}, grew=${contentGrew}, newData=${foundNewReactData}`,
  );

  return { scrollMoved, contentGrew, foundNewReactData };
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
      stats: { found: 0, stored: 0, duplicates: 0, ignored: 0 },
    };
  }

  let stableIterations = 0;
  let loopIteration = 0;
  const allComments: ScrapedComment[] = [];
  const savedCommentIds = new Set<string>();
  let lastIterationTime = Date.now();

  // Track cumulative stats
  const cumulativeStats: ScrapeStats = {
    found: 0,
    stored: 0,
    duplicates: 0,
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
      cumulativeStats.stored += result.stored;
      cumulativeStats.duplicates += result.duplicates;
      cumulativeStats.ignored += result.ignored;
      log(
        `[Tokative] Storage result: +${result.stored} stored, ${result.duplicates} dupes, ${result.ignored} ignored (totals: ${cumulativeStats.stored}/${cumulativeStats.found})`,
      );
      // Report progress immediately after main comments (before potentially slow reply expansion)
      onProgress?.(cumulativeStats);
    }

    // Early exit if we extracted a small batch (< 20 comments) - indicates we're near the end
    // Use rawComments (total extracted) not newComments (deduplicated) to avoid false positives
    // when TikTok's virtualized list recycles previously-seen comments
    if (rawComments.length > 0 && rawComments.length < 20) {
      log(
        `[Tokative] Small batch (${rawComments.length} < 20), likely reached end of comments`,
      );
      break;
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
      savedCommentIds,
    );
    log(
      `[Tokative] Scroll result: scrollMoved=${scrollResult.scrollMoved}, contentGrew=${scrollResult.contentGrew}, newReactData=${scrollResult.foundNewReactData}`,
    );

    // Track stability: we're done if no new comments AND scroll had no effect
    const foundNewComments = allComments.length > countBefore;
    const addedThisIteration = allComments.length - countBefore;

    // reachedEnd means the scroll produced no signs of more content
    const reachedEnd =
      !scrollResult.scrollMoved &&
      !scrollResult.contentGrew &&
      !scrollResult.foundNewReactData;

    log(
      `[Tokative] Iteration ${loopIteration} summary: foundNewComments=${foundNewComments} (+${addedThisIteration}), reachedEnd=${reachedEnd}`,
    );

    if (!foundNewComments && reachedEnd) {
      stableIterations++;
      log(
        `[Tokative] No new comments and reached end, stableIterations: ${stableIterations}/2`,
      );
      if (stableIterations >= 2) {
        log(
          "[Tokative] Stable for 2 iterations at end, assuming all comments loaded. Breaking loop.",
        );
        break;
      }
    } else {
      if (stableIterations > 0) {
        log(
          `[Tokative] Resetting stable counter (was ${stableIterations}): foundNew=${foundNewComments}, reachedEnd=${reachedEnd}`,
        );
      }
      stableIterations = 0;
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
  log(
    `[Tokative] Exit reason: ${isCancelled ? "cancelled" : stableIterations >= 2 ? "stable (no new comments at end)" : `maxComments reached (${maxComments})`}`,
  );

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
  const { timeout = 10000 } = options;
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
  timeout: number = 2000,
): Promise<string | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
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
  log("[Tokative] Closing modal with history.back()");
  window.history.back();

  // Wait for the video grid to reappear (confirms we're back on profile)
  const grid = await waitForSelector(VIDEO_SELECTORS.videoGrid, {
    timeout: 5000,
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

    if (videoItems.length === lastCount) {
      stableIterations++;
      if (stableIterations >= 3) {
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
    const emptyStats = { found: 0, stored: 0, duplicates: 0, ignored: 0 };
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
    const emptyStats = { found: 0, stored: 0, duplicates: 0, ignored: 0 };
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
      message: `Found ${stats.found}, stored ${stats.stored}`,
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

  if (isCancelled) {
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: result.stats.found,
      status: "cancelled",
      message: `Cancelled: ${result.stats.stored} stored, ${result.stats.ignored} ignored, ${result.stats.duplicates} duplicates`,
      stats: result.stats,
    });
    return result;
  }

  onProgress?.({
    videosProcessed: 1,
    totalVideos: 1,
    commentsFound: result.stats.found,
    status: "complete",
    message: `Done: ${result.stats.stored} stored, ${result.stats.ignored} ignored, ${result.stats.duplicates} duplicates`,
    stats: result.stats,
  });

  return result;
}
