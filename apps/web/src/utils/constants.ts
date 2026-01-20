export const EXTENSION_SOURCE = "tiktok-buddy-extension";

export const MessageType = {
  BRIDGE_READY: "BRIDGE_READY",
  CHECK_BRIDGE: "CHECK_BRIDGE",
  GET_STORED_USERS: "GET_STORED_USERS",
  USER_DATA_RESPONSE: "USER_DATA_RESPONSE",
  REMOVE_USER: "REMOVE_USER",
  REMOVE_USERS: "REMOVE_USERS",
  UPDATE_USER: "UPDATE_USER",
  SCRAPE_COMMENTS_START: "SCRAPE_COMMENTS_START",
  SCRAPE_COMMENTS_PROGRESS: "SCRAPE_COMMENTS_PROGRESS",
  SCRAPE_COMMENTS_COMPLETE: "SCRAPE_COMMENTS_COMPLETE",
  SCRAPE_COMMENTS_ERROR: "SCRAPE_COMMENTS_ERROR",
  SCRAPE_COMMENTS_STOP: "SCRAPE_COMMENTS_STOP",
  SEND_MESSAGE: "SEND_MESSAGE",
  SEND_MESSAGE_PROGRESS: "SEND_MESSAGE_PROGRESS",
  SEND_MESSAGE_COMPLETE: "SEND_MESSAGE_COMPLETE",
  SEND_MESSAGE_ERROR: "SEND_MESSAGE_ERROR",
  BULK_SEND_START: "BULK_SEND_START",
  BULK_SEND_PROGRESS: "BULK_SEND_PROGRESS",
  BULK_SEND_COMPLETE: "BULK_SEND_COMPLETE",
  BULK_SEND_ERROR: "BULK_SEND_ERROR",
  BULK_SEND_STOP: "BULK_SEND_STOP",
  GET_TEMPLATES: "GET_TEMPLATES",
  TEMPLATES_RESPONSE: "TEMPLATES_RESPONSE",
  SAVE_TEMPLATE: "SAVE_TEMPLATE",
  DELETE_TEMPLATE: "DELETE_TEMPLATE",
  GET_ACCOUNT_HANDLE: "GET_ACCOUNT_HANDLE",
  SAVE_ACCOUNT_HANDLE: "SAVE_ACCOUNT_HANDLE",
  GET_COMMENT_LIMIT: "GET_COMMENT_LIMIT",
  SAVE_COMMENT_LIMIT: "SAVE_COMMENT_LIMIT",
  REPLY_COMMENT: "REPLY_COMMENT",
  REPLY_COMMENT_PROGRESS: "REPLY_COMMENT_PROGRESS",
  REPLY_COMMENT_COMPLETE: "REPLY_COMMENT_COMPLETE",
  REPLY_COMMENT_ERROR: "REPLY_COMMENT_ERROR",
  BULK_REPLY_START: "BULK_REPLY_START",
  BULK_REPLY_PROGRESS: "BULK_REPLY_PROGRESS",
  BULK_REPLY_COMPLETE: "BULK_REPLY_COMPLETE",
  BULK_REPLY_STOP: "BULK_REPLY_STOP",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface ScrapedUser {
  id: string;
  handle: string;
  comment: string;
  scrapedAt: string;
  profileUrl: string;
  videoUrl?: string;
  messageSent?: boolean;
  sentAt?: string;
  messageError?: string;
  customMessage?: string;
  replySent?: boolean;
  repliedAt?: string;
  replyError?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  isDefault?: boolean;
}

export interface ScrapeProgress {
  current: number;
  total: number;
  newUsers: number;
  status: "scrolling" | "extracting" | "complete" | "error";
  message?: string;
}

export interface BulkSendProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
  status: "running" | "complete" | "stopped" | "error";
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
