export const EXTENSION_SOURCE = "tiktok-buddy-extension";

export const MessageType = {
  BRIDGE_READY: "BRIDGE_READY",
  CHECK_BRIDGE: "CHECK_BRIDGE",
  GET_SCRAPED_COMMENTS: "GET_SCRAPED_COMMENTS",
  SCRAPED_COMMENTS_RESPONSE: "SCRAPED_COMMENTS_RESPONSE",
  REMOVE_SCRAPED_COMMENT: "REMOVE_SCRAPED_COMMENT",
  REMOVE_SCRAPED_COMMENTS: "REMOVE_SCRAPED_COMMENTS",
  UPDATE_SCRAPED_COMMENT: "UPDATE_SCRAPED_COMMENT",
    GET_ACCOUNT_HANDLE: "GET_ACCOUNT_HANDLE",
  SAVE_ACCOUNT_HANDLE: "SAVE_ACCOUNT_HANDLE",
  GET_COMMENT_LIMIT: "GET_COMMENT_LIMIT",
  SAVE_COMMENT_LIMIT: "SAVE_COMMENT_LIMIT",
  GET_POST_LIMIT: "GET_POST_LIMIT",
  SAVE_POST_LIMIT: "SAVE_POST_LIMIT",
  REPLY_COMMENT: "REPLY_COMMENT",
  REPLY_COMMENT_PROGRESS: "REPLY_COMMENT_PROGRESS",
  REPLY_COMMENT_COMPLETE: "REPLY_COMMENT_COMPLETE",
  REPLY_COMMENT_ERROR: "REPLY_COMMENT_ERROR",
  BULK_REPLY_START: "BULK_REPLY_START",
  BULK_REPLY_PROGRESS: "BULK_REPLY_PROGRESS",
  BULK_REPLY_COMPLETE: "BULK_REPLY_COMPLETE",
  BULK_REPLY_STOP: "BULK_REPLY_STOP",
  SCRAPE_VIDEO_COMMENTS_START: "SCRAPE_VIDEO_COMMENTS_START",
  SCRAPE_VIDEO_COMMENTS_PROGRESS: "SCRAPE_VIDEO_COMMENTS_PROGRESS",
  SCRAPE_VIDEO_COMMENTS_COMPLETE: "SCRAPE_VIDEO_COMMENTS_COMPLETE",
  SCRAPE_VIDEO_COMMENTS_ERROR: "SCRAPE_VIDEO_COMMENTS_ERROR",
  SCRAPE_VIDEO_COMMENTS_STOP: "SCRAPE_VIDEO_COMMENTS_STOP",
  SCRAPE_VIDEOS_START: "SCRAPE_VIDEOS_START",
  SCRAPE_VIDEOS_PROGRESS: "SCRAPE_VIDEOS_PROGRESS",
  SCRAPE_VIDEOS_COMPLETE: "SCRAPE_VIDEOS_COMPLETE",
  SCRAPE_VIDEOS_ERROR: "SCRAPE_VIDEOS_ERROR",
  SCRAPE_VIDEOS_STOP: "SCRAPE_VIDEOS_STOP",
  GET_VIDEO_COMMENTS: "GET_VIDEO_COMMENTS",
  GET_VIDEO_COMMENTS_PROGRESS: "GET_VIDEO_COMMENTS_PROGRESS",
  GET_VIDEO_COMMENTS_COMPLETE: "GET_VIDEO_COMMENTS_COMPLETE",
  GET_VIDEO_COMMENTS_ERROR: "GET_VIDEO_COMMENTS_ERROR",
  GET_BATCH_COMMENTS: "GET_BATCH_COMMENTS",
  GET_BATCH_COMMENTS_PROGRESS: "GET_BATCH_COMMENTS_PROGRESS",
  GET_BATCH_COMMENTS_COMPLETE: "GET_BATCH_COMMENTS_COMPLETE",
  GET_BATCH_COMMENTS_ERROR: "GET_BATCH_COMMENTS_ERROR",
  SCRAPE_PAUSED: "SCRAPE_PAUSED",
  GET_STORED_VIDEOS: "GET_STORED_VIDEOS",
  REMOVE_VIDEO: "REMOVE_VIDEO",
  REMOVE_VIDEOS: "REMOVE_VIDEOS",
  GET_IGNORE_LIST: "GET_IGNORE_LIST",
  ADD_TO_IGNORE_LIST: "ADD_TO_IGNORE_LIST",
  REMOVE_FROM_IGNORE_LIST: "REMOVE_FROM_IGNORE_LIST",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface ScrapedComment {
  id: string;
  handle: string;
  comment: string;
  scrapedAt: string;
  profileUrl: string;
  videoUrl?: string;
  replySent?: boolean;
  repliedAt?: string;
  replyError?: string;
  replyContent?: string;
  commentTimestamp?: string;
  commentId?: string;
  videoId?: string;
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

export interface GetVideoCommentsProgress {
  videoId: string;
  status: "navigating" | "scraping" | "complete" | "error";
  message?: string;
  commentCount?: number;
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

export interface ScrapingState {
  isActive: boolean;
  isPaused: boolean;
  videoId: string | null;
  tabId: number | null;
  commentsFound: number;
  status: "loading" | "scraping" | "paused" | "complete" | "error" | "cancelled";
  message: string;
}

export interface IgnoreListEntry {
  text: string;
  addedAt: string;
}
