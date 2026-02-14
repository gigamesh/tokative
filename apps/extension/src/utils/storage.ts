import {
  ScrapedComment,
  ScrapedVideo,
  CommentScrapingState,
  IgnoreListEntry,
  RateLimitState,
} from "../types";
import * as convexApi from "./convex-api";
export { CommentLimitError, type AddCommentsResult } from "./errors";
import { CommentLimitError, type AddCommentsResult } from "./errors";

const STORAGE_KEYS = {
  SCRAPING_STATE: "tokative_scraping_state",
  RATE_LIMIT_STATE: "tokative_rate_limit_state",
} as const;

export async function getScrapedComments(): Promise<ScrapedComment[]> {
  return convexApi.fetchComments();
}

export async function addScrapedComments(newComments: ScrapedComment[]): Promise<AddCommentsResult> {
  const ignoreList = await convexApi.fetchIgnoreList();
  const result = await convexApi.syncComments(newComments, ignoreList.map((e) => e.text));
  if (result.limitReached) {
    throw new CommentLimitError(
      result.monthlyLimit ?? 0,
      result.currentCount ?? 0,
      result.plan ?? "free",
      { new: result.new, preexisting: result.preexisting, ignored: result.ignored },
    );
  }
  return result;
}

export async function updateScrapedComment(
  commentId: string,
  updates: Partial<ScrapedComment>
): Promise<void> {
  const convexUpdates: {
    repliedTo?: boolean;
    repliedAt?: number;
    replyError?: string;
    replyContent?: string;
  } = {};
  if (updates.repliedTo !== undefined) convexUpdates.repliedTo = updates.repliedTo;
  if (updates.repliedAt !== undefined) convexUpdates.repliedAt = new Date(updates.repliedAt).getTime();
  if (updates.replyError !== undefined) convexUpdates.replyError = updates.replyError;
  if (updates.replyContent !== undefined) convexUpdates.replyContent = updates.replyContent;

  if (Object.keys(convexUpdates).length > 0) {
    await convexApi.updateComment(commentId, convexUpdates);
  }
}

export async function removeScrapedComment(commentId: string): Promise<void> {
  await convexApi.deleteComment(commentId);
}

export async function removeScrapedComments(commentIds: string[]): Promise<void> {
  await convexApi.deleteComments(commentIds);
}

export async function getVideos(): Promise<ScrapedVideo[]> {
  return convexApi.fetchVideos();
}

export async function addVideos(newVideos: ScrapedVideo[]): Promise<number> {
  const result = await convexApi.syncVideos(newVideos);
  return result.stored;
}

export async function updateVideo(
  videoId: string,
  updates: Partial<ScrapedVideo>
): Promise<void> {
  if (updates.commentsScraped !== undefined) {
    await convexApi.updateVideo(videoId, { commentsScraped: updates.commentsScraped });
  }
}

export async function removeVideo(videoId: string): Promise<void> {
  await convexApi.deleteVideo(videoId);
}

export async function removeVideos(videoIds: string[]): Promise<void> {
  await convexApi.deleteVideos(videoIds);
}

export async function getIgnoreList(): Promise<IgnoreListEntry[]> {
  return convexApi.fetchIgnoreList();
}

export async function addToIgnoreList(text: string): Promise<void> {
  await convexApi.addToIgnoreListRemote(text);
}

export async function removeFromIgnoreList(text: string): Promise<void> {
  await convexApi.removeFromIgnoreListRemote(text);
}

export async function getPostLimit(): Promise<number> {
  const settings = await convexApi.fetchSettings();
  return settings.postLimit;
}

export async function savePostLimit(limit: number): Promise<void> {
  await convexApi.updateSettings({ postLimit: limit });
}

export async function getSettings(): Promise<convexApi.ConvexSettings> {
  return convexApi.fetchSettings();
}

export async function saveSettings(settings: Partial<convexApi.ConvexSettings>): Promise<void> {
  await convexApi.updateSettings(settings);
}

export async function getAccountHandle(): Promise<string | null> {
  const settings = await convexApi.fetchSettings();
  return settings.accountHandle;
}

export async function saveAccountHandle(handle: string): Promise<void> {
  const normalized = handle.replace(/^@/, "");
  await convexApi.updateSettings({ accountHandle: normalized });
}

// ===== LOCAL ONLY (ephemeral state) =====

const DEFAULT_SCRAPING_STATE: CommentScrapingState = {
  isActive: false,
  isPaused: false,
  videoId: null,
  tabId: null,
  commentsFound: 0,
  status: "complete",
  message: "",
};

export async function getScrapingState(): Promise<CommentScrapingState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SCRAPING_STATE);
  return result[STORAGE_KEYS.SCRAPING_STATE] || DEFAULT_SCRAPING_STATE;
}

export async function saveScrapingState(state: Partial<CommentScrapingState>): Promise<void> {
  const current = await getScrapingState();
  await chrome.storage.local.set({
    [STORAGE_KEYS.SCRAPING_STATE]: { ...current, ...state },
  });
}

export async function clearScrapingState(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SCRAPING_STATE]: DEFAULT_SCRAPING_STATE,
  });
}

const DEFAULT_RATE_LIMIT_STATE: RateLimitState = {
  isRateLimited: false,
  lastError: null,
  errorCount: 0,
  firstErrorAt: null,
  lastErrorAt: null,
  isPausedFor429: false,
  resumeAt: null,
};

export async function getRateLimitState(): Promise<RateLimitState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.RATE_LIMIT_STATE);
  return result[STORAGE_KEYS.RATE_LIMIT_STATE] || DEFAULT_RATE_LIMIT_STATE;
}

export async function recordRateLimitError(
  errorMessage: string,
  options?: { isPausedFor429?: boolean; resumeAt?: string }
): Promise<RateLimitState> {
  const current = await getRateLimitState();
  const now = new Date().toISOString();
  const newState: RateLimitState = {
    isRateLimited: true,
    lastError: errorMessage,
    errorCount: current.errorCount + 1,
    firstErrorAt: current.firstErrorAt || now,
    lastErrorAt: now,
    isPausedFor429: options?.isPausedFor429 ?? current.isPausedFor429 ?? false,
    resumeAt: options?.resumeAt ?? current.resumeAt ?? null,
  };
  await chrome.storage.local.set({
    [STORAGE_KEYS.RATE_LIMIT_STATE]: newState,
  });
  return newState;
}

export async function clearRateLimitState(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.RATE_LIMIT_STATE]: DEFAULT_RATE_LIMIT_STATE,
  });
}
