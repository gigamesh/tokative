import { VIDEO_SELECTORS } from "./video-selectors";
import { querySelector, querySelectorAll, waitForSelector } from "./selectors";
import type { ScrapedUser, VideoScrapeProgress } from "../../types";

interface RawCommentData {
  commentId: string;
  handle: string;
  displayName: string;
  comment: string;
  createTime: number;
  videoId: string;
  videoThumbnailUrl: string;
}

let isCancelled = false;

export function cancelVideoScrape(): void {
  isCancelled = true;
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

function getVideoMetadata(): { videoId: string | null; thumbnailUrl: string | null } {
  const ogImage = document.querySelector<HTMLMetaElement>(VIDEO_SELECTORS.videoMetaThumbnail[0]);
  const ogUrl = document.querySelector<HTMLMetaElement>(VIDEO_SELECTORS.videoMetaUrl[0]);

  return {
    videoId: ogUrl ? extractVideoIdFromUrl(ogUrl.content) : null,
    thumbnailUrl: ogImage?.content || null,
  };
}

function extractReactProps(element: Element): Record<string, unknown> | null {
  const keys = Object.getOwnPropertyNames(element);
  const fiberKey = keys.find((k) => k.startsWith("__reactFiber$"));
  if (!fiberKey) return null;

  const fiber = (element as Record<string, unknown>)[fiberKey] as Record<string, unknown>;
  return fiber?.memoizedProps as Record<string, unknown> | null;
}

function findInObject(obj: unknown, key: string): unknown[] {
  const results: unknown[] = [];
  function search(current: unknown, depth = 0): void {
    if (depth > 20 || current == null) return;
    if (typeof current !== "object") return;

    const record = current as Record<string, unknown>;
    if (key in record) {
      results.push(record[key]);
    }
    for (const value of Object.values(record)) {
      search(value, depth + 1);
    }
  }
  search(obj);
  return results;
}

function extractCommentDataFromReactProps(element: Element): Partial<RawCommentData> | null {
  const props = extractReactProps(element);
  if (!props) return null;

  const createTimes = findInObject(props, "create_time") as number[];
  const cids = findInObject(props, "cid") as string[];
  const awemeIds = findInObject(props, "aweme_id") as string[];

  return {
    createTime: createTimes[0],
    commentId: cids[0],
    videoId: awemeIds[0],
  };
}

function extractCommentFromDOM(commentContainer: Element): Partial<RawCommentData> | null {
  // First try to find an anchor element with href
  let usernameEl = querySelector<HTMLAnchorElement>(VIDEO_SELECTORS.commentUsername, commentContainer);

  // If we found an element but it's not an anchor, look for an anchor inside it
  if (usernameEl && usernameEl.tagName !== "A") {
    const anchorInside = usernameEl.querySelector("a");
    if (anchorInside) {
      usernameEl = anchorInside;
    }
  }

  if (!usernameEl) return null;

  const handle = extractHandleFromHref(usernameEl.href);
  if (!handle) return null;

  const displayName = usernameEl.textContent?.trim() || handle;

  const textEl = querySelector(VIDEO_SELECTORS.commentText, commentContainer);
  const comment = textEl?.textContent?.trim() || "";

  return { handle, displayName, comment };
}

export function scrapeCommentsFromCurrentVideo(): RawCommentData[] {
  const { videoId, thumbnailUrl } = getVideoMetadata();

  const commentItems = querySelectorAll(VIDEO_SELECTORS.commentItem);
  const comments: RawCommentData[] = [];
  const seenIds = new Set<string>();

  for (const item of commentItems) {
    const domData = extractCommentFromDOM(item);
    if (!domData || !domData.handle) continue;

    const reactData = extractCommentDataFromReactProps(item);
    const commentId = reactData?.commentId || "";

    // Deduplicate by commentId, or by handle+comment text if no commentId
    const dedupeKey = commentId || `${domData.handle}:${domData.comment?.slice(0, 50)}`;
    if (seenIds.has(dedupeKey)) continue;
    seenIds.add(dedupeKey);

    const comment: RawCommentData = {
      commentId,
      handle: domData.handle,
      displayName: domData.displayName || domData.handle,
      comment: domData.comment || "",
      createTime: reactData?.createTime || Math.floor(Date.now() / 1000),
      videoId: reactData?.videoId || videoId || "",
      videoThumbnailUrl: thumbnailUrl || "",
    };

    comments.push(comment);
  }

  console.log("[VideoScraper] Scraped", comments.length, "unique comments");
  return comments;
}

function rawCommentToScrapedUser(raw: RawCommentData): ScrapedUser {
  const cid = raw.commentId ? btoa(raw.commentId) : "";
  const videoUrl = raw.videoId
    ? `https://www.tiktok.com/video/${raw.videoId}${cid ? `?cid=${cid}` : ""}`
    : undefined;

  return {
    id: `${raw.handle}-${raw.commentId || Date.now()}`,
    handle: raw.handle,
    comment: raw.comment,
    scrapedAt: new Date().toISOString(),
    profileUrl: `https://www.tiktok.com/@${raw.handle}`,
    videoUrl,
    commentTimestamp: new Date(raw.createTime * 1000).toISOString(),
    videoThumbnailUrl: raw.videoThumbnailUrl,
    commentId: raw.commentId,
    videoId: raw.videoId,
  };
}

async function scrollToLoadComments(
  maxComments: number,
  onProgress?: (loaded: number) => void
): Promise<void> {
  const scroller = querySelector(VIDEO_SELECTORS.commentsScroller);
  if (!scroller) {
    console.log("[VideoScraper] Scroller not found");
    return;
  }

  let lastCount = 0;
  let stableIterations = 0;

  while (!isCancelled) {
    const comments = querySelectorAll(VIDEO_SELECTORS.commentItem);

    if (maxComments !== Infinity && comments.length >= maxComments) {
      console.log("[VideoScraper] Reached max comments:", comments.length);
      break;
    }

    if (comments.length === lastCount) {
      stableIterations++;
      if (stableIterations >= 3) {
        console.log("[VideoScraper] No more comments loading, stopping at:", comments.length);
        break;
      }
    } else {
      stableIterations = 0;
      lastCount = comments.length;
      onProgress?.(comments.length);
    }

    scroller.scrollTop = scroller.scrollHeight;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
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
        console.log("[VideoScraper] Found loaded comment with username:", usernameEl.textContent);
        return true;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return false;
}

async function openCommentsPanel(): Promise<boolean> {
  const existingComments = querySelector(VIDEO_SELECTORS.commentsContainer);
  if (existingComments) {
    console.log("[VideoScraper] Comments panel already open");
    return true;
  }

  const commentButton = querySelector<HTMLElement>(VIDEO_SELECTORS.commentButton);
  if (!commentButton) {
    console.log("[VideoScraper] Comment button not found");
    return false;
  }

  console.log("[VideoScraper] Clicking comment button...");
  commentButton.click();

  await new Promise((resolve) => setTimeout(resolve, 500));

  const commentsPanel = await waitForSelector(VIDEO_SELECTORS.commentsContainer, { timeout: 5000 });
  return commentsPanel !== null;
}

export async function scrapeVideoComments(
  maxComments: number = Infinity,
  onProgress?: (progress: VideoScrapeProgress) => void
): Promise<ScrapedUser[]> {
  isCancelled = false;

  console.log("[VideoScraper] Starting scrape...");

  onProgress?.({
    videosProcessed: 0,
    totalVideos: 1,
    commentsFound: 0,
    status: "loading",
    message: "Opening comments panel...",
  });

  const panelOpened = await openCommentsPanel();
  if (!panelOpened) {
    console.log("[VideoScraper] Failed to open comments panel");
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: 0,
      status: "error",
      message: "Could not open comments panel",
    });
    return [];
  }

  console.log("[VideoScraper] Comments panel opened, waiting for comments...");

  onProgress?.({
    videosProcessed: 0,
    totalVideos: 1,
    commentsFound: 0,
    status: "loading",
    message: "Loading comments...",
  });

  const foundElement = await waitForSelector(VIDEO_SELECTORS.commentItem, { timeout: 10000 });
  console.log("[VideoScraper] Found comment element:", foundElement);

  // Wait for actual content to load (not just skeleton placeholders)
  const contentLoaded = await waitForCommentContent({ timeout: 10000 });
  if (!contentLoaded) {
    console.log("[VideoScraper] Comment content never loaded (still showing skeletons)");
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: 0,
      status: "error",
      message: "Comments failed to load",
    });
    return [];
  }

  // Debug: log what we can find
  const debugItems = querySelectorAll(VIDEO_SELECTORS.commentItem);
  console.log("[VideoScraper] Found", debugItems.length, "comment items with content");
  if (debugItems.length > 0) {
    const firstUsername = querySelector(VIDEO_SELECTORS.commentUsername, debugItems[0]);
    console.log("[VideoScraper] First comment username:", firstUsername?.textContent);
  }

  await scrollToLoadComments(maxComments, (loaded) => {
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: loaded,
      status: "scraping",
      message: `Found ${loaded} comments...`,
    });
  });

  if (isCancelled) {
    onProgress?.({
      videosProcessed: 0,
      totalVideos: 1,
      commentsFound: 0,
      status: "cancelled",
      message: "Scraping cancelled",
    });
    return [];
  }

  const rawComments = scrapeCommentsFromCurrentVideo();
  const users = rawComments.map(rawCommentToScrapedUser);

  onProgress?.({
    videosProcessed: 1,
    totalVideos: 1,
    commentsFound: users.length,
    status: "complete",
    message: `Scraped ${users.length} comments`,
  });

  return users;
}
