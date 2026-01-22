export const EXTENSION_SOURCE = "tiktok-buddy-extension";

export const MessageType = {
  BRIDGE_READY: "BRIDGE_READY",
  CHECK_BRIDGE: "CHECK_BRIDGE",
  GET_STORED_USERS: "GET_STORED_USERS",
  USER_DATA_RESPONSE: "USER_DATA_RESPONSE",
  REMOVE_USER: "REMOVE_USER",
  REMOVE_USERS: "REMOVE_USERS",
  UPDATE_USER: "UPDATE_USER",
  GET_TEMPLATES: "GET_TEMPLATES",
  TEMPLATES_RESPONSE: "TEMPLATES_RESPONSE",
  SAVE_TEMPLATE: "SAVE_TEMPLATE",
  DELETE_TEMPLATE: "DELETE_TEMPLATE",
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
  GET_STORED_VIDEOS: "GET_STORED_VIDEOS",
  REMOVE_VIDEO: "REMOVE_VIDEO",
  REMOVE_VIDEOS: "REMOVE_VIDEOS",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface ScrapedUser {
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
  videoThumbnailUrl?: string;
  commentId?: string;
  videoId?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  isDefault?: boolean;
}

export interface ReplyProgress {
  userId: string;
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
  currentVideoId: string | null;
  totalComments: number;
  status: "processing" | "complete" | "error";
  message?: string;
}
