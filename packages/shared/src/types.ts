export const EXTENSION_SOURCE = "tokative-extension";

export const MessageType = {
  // Bridge communication
  BRIDGE_READY: "BRIDGE_READY",
  CHECK_BRIDGE: "CHECK_BRIDGE",

  // Auth token relay (web app → extension)
  GET_AUTH_TOKEN: "GET_AUTH_TOKEN",
  AUTH_TOKEN_RESPONSE: "AUTH_TOKEN_RESPONSE",

  // Scraped comments data
  GET_SCRAPED_COMMENTS: "GET_SCRAPED_COMMENTS",
  SCRAPED_COMMENTS_RESPONSE: "SCRAPED_COMMENTS_RESPONSE",
  REMOVE_SCRAPED_COMMENT: "REMOVE_SCRAPED_COMMENT",
  REMOVE_SCRAPED_COMMENTS: "REMOVE_SCRAPED_COMMENTS",
  UPDATE_SCRAPED_COMMENT: "UPDATE_SCRAPED_COMMENT",

  // Tab management
  OPEN_TIKTOK_TAB: "OPEN_TIKTOK_TAB",
  OPEN_DASHBOARD_TAB: "OPEN_DASHBOARD_TAB",
  GET_TIKTOK_TAB: "GET_TIKTOK_TAB",

  // Extension detection
  CHECK_EXTENSION: "CHECK_EXTENSION",
  EXTENSION_STATUS: "EXTENSION_STATUS",

  // Account
  GET_ACCOUNT_HANDLE: "GET_ACCOUNT_HANDLE",
  SAVE_ACCOUNT_HANDLE: "SAVE_ACCOUNT_HANDLE",
  GET_COMMENT_LIMIT: "GET_COMMENT_LIMIT",
  SAVE_COMMENT_LIMIT: "SAVE_COMMENT_LIMIT",
  GET_POST_LIMIT: "GET_POST_LIMIT",
  SAVE_POST_LIMIT: "SAVE_POST_LIMIT",

  // Reply to comment
  REPLY_COMMENT: "REPLY_COMMENT",
  REPLY_COMMENT_PROGRESS: "REPLY_COMMENT_PROGRESS",
  REPLY_COMMENT_COMPLETE: "REPLY_COMMENT_COMPLETE",
  REPLY_COMMENT_ERROR: "REPLY_COMMENT_ERROR",

  // Bulk reply
  BULK_REPLY_START: "BULK_REPLY_START",
  BULK_REPLY_PROGRESS: "BULK_REPLY_PROGRESS",
  BULK_REPLY_COMPLETE: "BULK_REPLY_COMPLETE",
  BULK_REPLY_STOP: "BULK_REPLY_STOP",

  // Video comment scraping (single video)
  SCRAPE_VIDEO_COMMENTS_START: "SCRAPE_VIDEO_COMMENTS_START",
  SCRAPE_VIDEO_COMMENTS_PROGRESS: "SCRAPE_VIDEO_COMMENTS_PROGRESS",
  SCRAPE_VIDEO_COMMENTS_COMPLETE: "SCRAPE_VIDEO_COMMENTS_COMPLETE",
  SCRAPE_VIDEO_COMMENTS_ERROR: "SCRAPE_VIDEO_COMMENTS_ERROR",
  SCRAPE_VIDEO_COMMENTS_STOP: "SCRAPE_VIDEO_COMMENTS_STOP",

  // Video metadata scraping (thumbnails/IDs from profile grid)
  SCRAPE_VIDEOS_START: "SCRAPE_VIDEOS_START",
  SCRAPE_VIDEOS_PROGRESS: "SCRAPE_VIDEOS_PROGRESS",
  SCRAPE_VIDEOS_COMPLETE: "SCRAPE_VIDEOS_COMPLETE",
  SCRAPE_VIDEOS_ERROR: "SCRAPE_VIDEOS_ERROR",
  SCRAPE_VIDEOS_STOP: "SCRAPE_VIDEOS_STOP",

  // Get comments for a specific video
  GET_VIDEO_COMMENTS: "GET_VIDEO_COMMENTS",
  GET_VIDEO_COMMENTS_PROGRESS: "GET_VIDEO_COMMENTS_PROGRESS",
  GET_VIDEO_COMMENTS_COMPLETE: "GET_VIDEO_COMMENTS_COMPLETE",
  GET_VIDEO_COMMENTS_ERROR: "GET_VIDEO_COMMENTS_ERROR",

  // Batch comment fetching
  GET_BATCH_COMMENTS: "GET_BATCH_COMMENTS",
  GET_BATCH_COMMENTS_PROGRESS: "GET_BATCH_COMMENTS_PROGRESS",
  GET_BATCH_COMMENTS_COMPLETE: "GET_BATCH_COMMENTS_COMPLETE",
  GET_BATCH_COMMENTS_ERROR: "GET_BATCH_COMMENTS_ERROR",

  // Pause/resume scraping
  SCRAPE_PAUSE: "SCRAPE_PAUSE",
  SCRAPE_RESUME: "SCRAPE_RESUME",
  SCRAPE_PAUSED: "SCRAPE_PAUSED",

  // Scraping state
  GET_SCRAPING_STATE: "GET_SCRAPING_STATE",

  // Video storage
  GET_STORED_VIDEOS: "GET_STORED_VIDEOS",
  VIDEOS_RESPONSE: "VIDEOS_RESPONSE",
  REMOVE_VIDEO: "REMOVE_VIDEO",
  REMOVE_VIDEOS: "REMOVE_VIDEOS",

  // Ignore list
  GET_IGNORE_LIST: "GET_IGNORE_LIST",
  ADD_TO_IGNORE_LIST: "ADD_TO_IGNORE_LIST",
  REMOVE_FROM_IGNORE_LIST: "REMOVE_FROM_IGNORE_LIST",

  // Storage updates (auto-broadcast when data changes)
  COMMENTS_UPDATED: "COMMENTS_UPDATED",

  // Rate limit detection
  RATE_LIMIT_DETECTED: "RATE_LIMIT_DETECTED",
  RATE_LIMIT_CLEARED: "RATE_LIMIT_CLEARED",
  GET_RATE_LIMIT_STATE: "GET_RATE_LIMIT_STATE",
  CLEAR_RATE_LIMIT: "CLEAR_RATE_LIMIT",

  // Tab visibility
  ACTIVATE_TAB: "ACTIVATE_TAB",

  // Remote config
  GET_CONFIG: "GET_CONFIG",
  REFRESH_CONFIG: "REFRESH_CONFIG",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface ScrapedComment {
  id: string;
  tiktokUserId: string;
  handle: string;
  comment: string;
  scrapedAt: string;
  profileUrl: string;
  avatarUrl?: string;
  videoUrl?: string;
  replySent?: boolean;
  repliedAt?: string;
  replyError?: string;
  replyContent?: string;
  commentTimestamp?: string;
  commentId?: string;
  videoId?: string;
  parentCommentId?: string | null;
  replyToReplyId?: string | null;
  isReply?: boolean;
  replyCount?: number;
  source?: "app" | "scraped";
}

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  source?: "dashboard" | "tiktok" | "background" | "popup";
}

export interface ReplyProgress {
  commentId: string;
  status: "navigating" | "finding" | "replying" | "complete" | "error";
  message?: string;
}

export interface BulkReplyProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  current?: string;
  status: "running" | "complete" | "stopped" | "error";
}

export interface ScrapedVideo {
  id: string;
  videoId: string;
  thumbnailUrl: string;
  videoUrl: string;
  profileHandle: string;
  order: number;
  scrapedAt: string;
  commentsScraped?: boolean;
}

export interface VideoMetadataScrapeProgress {
  videosFound: number;
  status: "scrolling" | "extracting" | "complete" | "error" | "cancelled";
  message?: string;
  limitReached?: boolean;
}

export interface ScrapeStats {
  found: number;       // Total comments found/scraped from page
  new: number;         // Actually saved to storage (new unique)
  preexisting: number; // Rejected because already in storage
  ignored: number;     // Rejected by ignore list
}

export interface VideoScrapeProgress {
  videosProcessed: number;
  totalVideos: number;
  commentsFound: number;
  status: "loading" | "scraping" | "complete" | "error" | "cancelled";
  message: string;
  stats?: ScrapeStats; // Detailed breakdown
}

export interface CommentScrapingState {
  isActive: boolean;
  isPaused: boolean;
  videoId: string | null;
  tabId: number | null;
  commentsFound: number;
  status: "loading" | "scraping" | "paused" | "complete" | "error" | "cancelled";
  message: string;
}

export type ScrapingState = CommentScrapingState;

export interface IgnoreListEntry {
  text: string;
  addedAt: string;
}

export interface TiktokProfile {
  id: string;
  tiktokUserId: string;
  handle: string;
  profileUrl: string;
  avatarUrl?: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface GetVideoCommentsProgress {
  videoId: string;
  status: "navigating" | "scraping" | "complete" | "error";
  message?: string;
  commentCount?: number;
  stats?: ScrapeStats;
}

export interface BatchCommentsProgress {
  totalVideos: number;
  completedVideos: number;
  currentVideoIndex: number;
  currentVideoId: string | null;
  totalComments: number;
  status: "processing" | "complete" | "error";
  message?: string;
}

export interface RateLimitState {
  isRateLimited: boolean;
  lastError: string | null;
  errorCount: number;
  firstErrorAt: string | null;
  lastErrorAt: string | null;
  isPausedFor429: boolean;
  resumeAt: string | null;
}
