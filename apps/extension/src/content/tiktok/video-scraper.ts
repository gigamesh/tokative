import { VIDEO_SELECTORS } from "./video-selectors";
import { querySelector, querySelectorAll, waitForSelector } from "./selectors";
import { addScrapedComments, addVideos } from "../../utils/storage";
import { humanDelay, humanDelayWithJitter } from "../../utils/dom";
import type { ScrapedComment, ScrapedVideo, VideoScrapeProgress, VideoMetadataScrapeProgress } from "../../types";

interface RawCommentData {
  commentId: string;
  handle: string;
  displayName: string;
  comment: string;
  createTime: number;
  videoId: string;
}

let isCancelled = false;
let isPaused = false;

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

function getVideoId(): string | null {
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
}

function injectReactExtractor(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById("tiktok-buddy-extractor")) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = "tiktok-buddy-extractor";
    script.src = chrome.runtime.getURL("page-script.js");
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.documentElement.appendChild(script);
  });
}

async function extractAllReactData(): Promise<Map<number, CommentReactData>> {
  await injectReactExtractor();

  const isReady = document.documentElement.getAttribute("data-tiktok-buddy-ready") === "true";
  console.log("[TikTok Buddy] React extractor ready:", isReady);
  if (!isReady) {
    return new Map();
  }

  // Trigger extraction via a custom event
  const extractEvent = new CustomEvent("tiktok-buddy-extract");
  document.dispatchEvent(extractEvent);

  // Wait a tick for the extraction to complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  const dataAttr = document.documentElement.getAttribute("data-tiktok-buddy-comments");
  document.documentElement.removeAttribute("data-tiktok-buddy-comments");

  console.log("[TikTok Buddy] React data attribute length:", dataAttr?.length || 0);

  const results = new Map<number, CommentReactData>();
  if (dataAttr) {
    try {
      const parsed = JSON.parse(dataAttr) as Array<{ index: number; cid: string; create_time: number; aweme_id: string }>;
      console.log("[TikTok Buddy] Parsed React data for", parsed.length, "comments");
      for (const item of parsed) {
        results.set(item.index, {
          cid: item.cid,
          create_time: item.create_time,
          aweme_id: item.aweme_id,
        });
      }
    } catch (e) {
      console.error("[TikTok Buddy] Failed to parse React data:", e);
    }
  }

  return results;
}

function extractCommentFromDOM(commentContainer: Element): Partial<RawCommentData> | null {
  // The comment content container has the comment ID as its id attribute
  const contentContainer = commentContainer.querySelector('[class*="DivCommentContentContainer"]');
  const commentId = contentContainer?.id || commentContainer.id || "";

  // First try to find an anchor element with href
  let usernameEl = querySelector<HTMLAnchorElement>(VIDEO_SELECTORS.commentUsername, commentContainer);

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

export async function scrapeCommentsFromCurrentVideo(): Promise<RawCommentData[]> {
  const videoId = getVideoId();
  console.log("[TikTok Buddy] Video ID:", videoId);

  // Try to get React data for timestamps, but don't require it
  const reactDataMap = await extractAllReactData();
  console.log("[TikTok Buddy] React data map size:", reactDataMap.size);

  const commentItems = querySelectorAll(VIDEO_SELECTORS.commentItem);
  console.log("[TikTok Buddy] Comment items found:", commentItems.length);

  const comments: RawCommentData[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < commentItems.length; i++) {
    const item = commentItems[i];
    const domData = extractCommentFromDOM(item);
    if (!domData || !domData.handle) continue;

    // Use DOM comment ID (from element id attribute), fall back to React data
    const reactData = reactDataMap.get(i);
    const commentId = domData.commentId || reactData?.cid || "";

    // Skip comments without an ID
    if (!commentId) {
      console.log("[TikTok Buddy] Skipping comment without ID, handle:", domData.handle);
      continue;
    }

    // Deduplicate by commentId
    if (seenIds.has(commentId)) continue;
    seenIds.add(commentId);

    const comment: RawCommentData = {
      commentId,
      handle: domData.handle,
      displayName: domData.displayName || domData.handle,
      comment: domData.comment || "",
      createTime: reactData?.create_time || Math.floor(Date.now() / 1000),
      videoId: reactData?.aweme_id || videoId || "",
    };

    comments.push(comment);
  }

  console.log("[TikTok Buddy] Extracted", comments.length, "comments with IDs");
  return comments;
}

function getVideoAuthorFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/@([^/?]+)/);
  return match ? match[1] : null;
}

function rawCommentToScrapedComment(raw: RawCommentData): ScrapedComment | null {
  if (!raw.commentId) {
    return null;
  }

  const cid = btoa(raw.commentId);
  const videoAuthor = getVideoAuthorFromUrl();
  const videoUrl = raw.videoId && videoAuthor
    ? `https://www.tiktok.com/@${videoAuthor}/video/${raw.videoId}?cid=${cid}`
    : undefined;

  return {
    id: `${raw.handle}-${raw.commentId}`,
    handle: raw.handle,
    comment: raw.comment,
    scrapedAt: new Date().toISOString(),
    profileUrl: `https://www.tiktok.com/@${raw.handle}`,
    videoUrl,
    commentTimestamp: new Date(raw.createTime * 1000).toISOString(),
    commentId: raw.commentId,
    videoId: raw.videoId,
  };
}

async function scrollToLoadComments(
  maxComments: number,
  onProgress?: (loaded: number, saved: number) => void
): Promise<ScrapedComment[]> {
  console.log("[TikTok Buddy] scrollToLoadComments called, maxComments:", maxComments);

  const scroller = querySelector(VIDEO_SELECTORS.commentsScroller);
  console.log("[TikTok Buddy] Scroller element found:", !!scroller);
  if (scroller) {
    console.log("[TikTok Buddy] Scroller details:", {
      className: scroller.className,
      tagName: scroller.tagName,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      scrollTop: scroller.scrollTop,
    });
  }
  if (!scroller) {
    console.log("[TikTok Buddy] No scroller found, trying all selectors:", VIDEO_SELECTORS.commentsScroller);
    // Debug: list all potential scrollers
    const allDivs = document.querySelectorAll('[class*="Comment"]');
    console.log("[TikTok Buddy] Elements with 'Comment' in class:", allDivs.length);
    allDivs.forEach((div, i) => {
      if (i < 5) console.log(`  [${i}] ${div.tagName}.${div.className.substring(0, 60)}`);
    });
    return [];
  }

  let lastCount = 0;
  let stableIterations = 0;
  let loopIteration = 0;
  const allComments: ScrapedComment[] = [];
  const savedCommentIds = new Set<string>();
  let lastIterationTime = Date.now();

  while (!isCancelled) {
    loopIteration++;
    const now = Date.now();
    const timeSinceLastIteration = now - lastIterationTime;
    lastIterationTime = now;
    console.log(`[TikTok Buddy] === Scroll loop iteration ${loopIteration} === (${timeSinceLastIteration}ms since last)`);

    await waitWhilePaused();
    if (isCancelled) {
      console.log("[TikTok Buddy] Scrape cancelled, exiting loop");
      break;
    }

    const commentElements = querySelectorAll(VIDEO_SELECTORS.commentItem);
    console.log(`[TikTok Buddy] Found ${commentElements.length} comment elements (lastCount: ${lastCount}), saved comments: ${allComments.length}`);

    // Check against actual saved comments, not DOM elements (which may include replies)
    if (maxComments !== Infinity && allComments.length >= maxComments) {
      console.log(`[TikTok Buddy] Reached maxComments limit (${allComments.length} >= ${maxComments}), breaking`);
      break;
    }

    if (commentElements.length === lastCount) {
      stableIterations++;
      console.log(`[TikTok Buddy] No new comment elements, stableIterations: ${stableIterations}/3`);
      console.log(`[TikTok Buddy] Scroller state: scrollTop=${scroller.scrollTop}, scrollHeight=${scroller.scrollHeight}, clientHeight=${scroller.clientHeight}`);

      // Check if we're actually at the bottom
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 10;
      console.log(`[TikTok Buddy] At bottom: ${atBottom}`);

      if (stableIterations >= 3) {
        console.log("[TikTok Buddy] Stable for 3 iterations, assuming all comments loaded. Breaking loop.");
        break;
      }
    } else {
      stableIterations = 0;
      lastCount = commentElements.length;

      // Extract and save comments incrementally on each scroll
      const rawComments = await scrapeCommentsFromCurrentVideo();
      console.log(`[TikTok Buddy] Extracted ${rawComments.length} raw comments from DOM`);
      const newComments: ScrapedComment[] = [];

      // Calculate how many more comments we can add
      const remainingBudget = maxComments === Infinity ? Infinity : maxComments - allComments.length;

      for (const raw of rawComments) {
        // Stop if we've used up our budget
        if (remainingBudget !== Infinity && newComments.length >= remainingBudget) {
          break;
        }

        const scraped = rawCommentToScrapedComment(raw);
        if (scraped && !savedCommentIds.has(scraped.id)) {
          newComments.push(scraped);
          savedCommentIds.add(scraped.id);
          allComments.push(scraped);
        }
      }

      console.log(`[TikTok Buddy] New unique comments this iteration: ${newComments.length}, total: ${allComments.length}/${maxComments}`);

      if (newComments.length > 0) {
        const savedCount = await addScrapedComments(newComments);
        console.log(`[TikTok Buddy] Saved ${savedCount} comments to storage`);
      }

      onProgress?.(commentElements.length, allComments.length);
    }

    const scrollBefore = scroller.scrollTop;
    scroller.scrollTop = scroller.scrollHeight;
    const scrollAfter = scroller.scrollTop;
    console.log(`[TikTok Buddy] Scroll: ${scrollBefore} -> ${scrollAfter} (target: ${scroller.scrollHeight})`);

    await humanDelayWithJitter("medium");
  }

  console.log(`[TikTok Buddy] ====== Scroll loop finished ======`);
  console.log(`[TikTok Buddy] Total iterations: ${loopIteration}`);
  console.log(`[TikTok Buddy] Final DOM elements: ${querySelectorAll(VIDEO_SELECTORS.commentItem).length}`);
  console.log(`[TikTok Buddy] Total unique comments collected: ${allComments.length}`);
  console.log(`[TikTok Buddy] Exit reason: ${isCancelled ? 'cancelled' : stableIterations >= 3 ? 'stable (no new comments)' : `maxComments reached (${maxComments})`}`);

  // Truncate to exact limit if we collected more than requested
  if (maxComments !== Infinity && allComments.length > maxComments) {
    console.log(`[TikTok Buddy] Truncating from ${allComments.length} to ${maxComments} comments`);
    return allComments.slice(0, maxComments);
  }

  return allComments;
}

async function waitForCommentContent(options: { timeout?: number } = {}): Promise<boolean> {
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
  console.log("[TikTok Buddy] openCommentsPanel called");
  const existingComments = querySelector(VIDEO_SELECTORS.commentsContainer);
  console.log("[TikTok Buddy] Existing comments panel:", !!existingComments);
  if (existingComments) {
    return true;
  }

  console.log("[TikTok Buddy] Looking for comment button with selectors:", VIDEO_SELECTORS.commentButton);
  const commentButton = querySelector<HTMLElement>(VIDEO_SELECTORS.commentButton);
  console.log("[TikTok Buddy] Comment button found:", !!commentButton);
  if (!commentButton) {
    console.log("[TikTok Buddy] Waiting for comment button...");
    const button = await waitForSelector(VIDEO_SELECTORS.commentButton, { timeout: 10000 });
    console.log("[TikTok Buddy] Comment button after wait:", !!button);
    if (!button) {
      console.log("[TikTok Buddy] ERROR: Comment button not found after 10s timeout");
      return false;
    }
    console.log("[TikTok Buddy] Clicking comment button (waited)");
    (button as HTMLElement).click();
  } else {
    console.log("[TikTok Buddy] Clicking comment button (immediate)");
    commentButton.click();
  }

  await humanDelay("short");

  console.log("[TikTok Buddy] Waiting for comments panel to appear...");
  const commentsPanel = await waitForSelector(VIDEO_SELECTORS.commentsContainer, { timeout: 10000 });
  console.log("[TikTok Buddy] Comments panel found:", !!commentsPanel);
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
    const match = style?.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/);
    if (match && match[1] && match[1].startsWith("http")) {
      return match[1];
    }
  }

  return null;
}

async function waitForThumbnailToLoad(videoItem: Element, timeout: number = 2000): Promise<string | null> {
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
  console.log("[TikTok Buddy] Closing modal with history.back()");
  window.history.back();

  // Wait for the video grid to reappear (confirms we're back on profile)
  const grid = await waitForSelector(VIDEO_SELECTORS.videoGrid, { timeout: 5000 });
  if (grid) {
    console.log("[TikTok Buddy] Back on profile page, video grid found");
  } else {
    console.log("[TikTok Buddy] Warning: video grid not found after going back");
  }

  await humanDelay("short");
}

async function clickVideoItem(videoItem: Element): Promise<boolean> {
  const clickTarget = videoItem.querySelector("a") as HTMLElement | null;
  if (!clickTarget) return false;

  // Push current URL to history before clicking, so history.back() has somewhere to go
  const currentUrl = window.location.href;
  window.history.pushState({ tiktokBuddy: true }, "", currentUrl);
  console.log("[TikTok Buddy] Pushed history state before clicking video");

  clickTarget.click();
  await humanDelayWithJitter("medium");

  const modal = await waitForSelector(VIDEO_SELECTORS.videoModal, { timeout: 5000 });
  return modal !== null;
}

export async function scrapeProfileVideos(
  maxVideos: number = Infinity,
  maxCommentsPerVideo: number = Infinity,
  onProgress?: (progress: VideoScrapeProgress) => void
): Promise<ScrapedComment[]> {
  isCancelled = false;
  const allComments: ScrapedComment[] = [];
  const videoThumbnails = new Map<string, string>();

  console.log("[TikTok Buddy] Starting profile scrape");

  const videoGrid = querySelector(VIDEO_SELECTORS.videoGrid);
  if (!videoGrid) {
    console.log("[TikTok Buddy] No video grid found");
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

  console.log(`[TikTok Buddy] Found ${videoItems.length} videos, will process ${videosToProcess}`);

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

      console.log(`[TikTok Buddy] Processing video ${i + 1}: ${videoId}, thumbnail: ${thumbnail ? 'yes' : 'no'}`);

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
        console.log(`[TikTok Buddy] Failed to open modal for video ${i + 1}`);
        continue;
      }

      console.log(`[TikTok Buddy] Modal opened for video ${i + 1}`);
      await humanDelay("short");

      const comments = await scrapeVideoComments(maxCommentsPerVideo, (progress) => {
        onProgress?.({
          videosProcessed: i,
          totalVideos: videosToProcess,
          commentsFound: allComments.length + progress.commentsFound,
          status: "scraping",
          message: `Video ${i + 1}/${videosToProcess}: ${progress.message}`,
        });
      });

      console.log(`[TikTok Buddy] Scraped ${comments.length} comments from video ${i + 1}`);

      // Just track locally - saving already happened incrementally during scroll
      for (const comment of comments) {
        allComments.push(comment);
      }

      console.log(`[TikTok Buddy] Closing modal for video ${i + 1}`);
      await closeVideoModal();
      await humanDelayWithJitter("long");
    } catch (error) {
      console.error(`[TikTok Buddy] Error processing video ${i + 1}:`, error);
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
    console.log("[TikTok Buddy] Scraping cancelled");
    onProgress?.({
      videosProcessed: 0,
      totalVideos: videosToProcess,
      commentsFound: allComments.length,
      status: "cancelled",
      message: "Scraping cancelled",
    });
    return allComments;
  }

  console.log(`[TikTok Buddy] Scraping complete: ${allComments.length} comments from ${videosToProcess} videos`);
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
  onProgress?: (progress: VideoMetadataScrapeProgress) => void
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

  console.log("[TikTok Buddy] Starting video metadata scrape for @" + profileHandle + " (max: " + maxVideos + ")");

  onProgress?.({
    videosFound: 0,
    status: "scrolling",
    message: "Looking for video grid...",
  });

  const videoGrid = await waitForSelector(VIDEO_SELECTORS.videoGrid, { timeout: 10000 });
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
        console.log(`[TikTok Buddy] Incrementally saved ${savedCount} new videos`);
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
    console.log(`[TikTok Buddy] Final save: ${savedCount} new videos`);

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

export async function scrapeVideoComments(
  maxComments: number = Infinity,
  onProgress?: (progress: VideoScrapeProgress) => void
): Promise<ScrapedComment[]> {
  console.log("[TikTok Buddy] scrapeVideoComments called, maxComments:", maxComments);
  isCancelled = false;

  onProgress?.({
    videosProcessed: 0,
    totalVideos: 1,
    commentsFound: 0,
    status: "loading",
    message: "Opening comments panel...",
  });

  console.log("[TikTok Buddy] Opening comments panel...");
  const panelOpened = await openCommentsPanel();
  console.log("[TikTok Buddy] Panel opened:", panelOpened);
  if (!panelOpened) {
    console.log("[TikTok Buddy] ERROR: Could not open comments panel");
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: 0,
      status: "error",
      message: "Could not open comments panel",
    });
    return [];
  }

  onProgress?.({
    videosProcessed: 0,
    totalVideos: 1,
    commentsFound: 0,
    status: "loading",
    message: "Loading comments...",
  });

  console.log("[TikTok Buddy] Waiting for comment items...");
  await waitForSelector(VIDEO_SELECTORS.commentItem, { timeout: 10000 });
  console.log("[TikTok Buddy] Comment items selector found");

  console.log("[TikTok Buddy] Waiting for comment content...");
  const contentLoaded = await waitForCommentContent({ timeout: 10000 });
  console.log("[TikTok Buddy] Comment content loaded:", contentLoaded);
  if (!contentLoaded) {
    console.log("[TikTok Buddy] ERROR: Comments failed to load");
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: 0,
      status: "error",
      message: "Comments failed to load",
    });
    return [];
  }

  console.log("[TikTok Buddy] Starting scroll loop...");
  // scrollToLoadComments now handles extraction and saving incrementally
  const comments = await scrollToLoadComments(maxComments, (loaded, saved) => {
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: saved,
      status: "scraping",
      message: `Scraping... ${saved} comments`,
    });
  });
  console.log("[TikTok Buddy] Scroll loop completed, comments:", comments.length);

  if (isCancelled) {
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: comments.length,
      status: "cancelled",
      message: "Scraping cancelled",
    });
    return comments;
  }

  onProgress?.({
    videosProcessed: 1,
    totalVideos: 1,
    commentsFound: comments.length,
    status: "complete",
    message: `Scraped ${comments.length} comments`,
  });

  return comments;
}
