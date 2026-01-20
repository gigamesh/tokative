export enum MessageType {
  // Bridge communication
  BRIDGE_READY = "BRIDGE_READY",
  CHECK_BRIDGE = "CHECK_BRIDGE",

  // User data
  GET_STORED_USERS = "GET_STORED_USERS",
  USER_DATA_RESPONSE = "USER_DATA_RESPONSE",
  REMOVE_USER = "REMOVE_USER",
  REMOVE_USERS = "REMOVE_USERS",
  UPDATE_USER = "UPDATE_USER",

  // Scraping
  SCRAPE_COMMENTS_START = "SCRAPE_COMMENTS_START",
  SCRAPE_COMMENTS_PROGRESS = "SCRAPE_COMMENTS_PROGRESS",
  SCRAPE_COMMENTS_COMPLETE = "SCRAPE_COMMENTS_COMPLETE",
  SCRAPE_COMMENTS_ERROR = "SCRAPE_COMMENTS_ERROR",
  SCRAPE_COMMENTS_STOP = "SCRAPE_COMMENTS_STOP",

  // Messaging
  SEND_MESSAGE = "SEND_MESSAGE",
  SEND_MESSAGE_PROGRESS = "SEND_MESSAGE_PROGRESS",
  SEND_MESSAGE_COMPLETE = "SEND_MESSAGE_COMPLETE",
  SEND_MESSAGE_ERROR = "SEND_MESSAGE_ERROR",

  // Bulk messaging
  BULK_SEND_START = "BULK_SEND_START",
  BULK_SEND_PROGRESS = "BULK_SEND_PROGRESS",
  BULK_SEND_COMPLETE = "BULK_SEND_COMPLETE",
  BULK_SEND_ERROR = "BULK_SEND_ERROR",
  BULK_SEND_STOP = "BULK_SEND_STOP",

  // Templates
  GET_TEMPLATES = "GET_TEMPLATES",
  TEMPLATES_RESPONSE = "TEMPLATES_RESPONSE",
  SAVE_TEMPLATE = "SAVE_TEMPLATE",
  DELETE_TEMPLATE = "DELETE_TEMPLATE",

  // Tab management
  OPEN_TIKTOK_TAB = "OPEN_TIKTOK_TAB",
  GET_TIKTOK_TAB = "GET_TIKTOK_TAB",

  // Account
  GET_ACCOUNT_HANDLE = "GET_ACCOUNT_HANDLE",
  SAVE_ACCOUNT_HANDLE = "SAVE_ACCOUNT_HANDLE",
  GET_COMMENT_LIMIT = "GET_COMMENT_LIMIT",
  SAVE_COMMENT_LIMIT = "SAVE_COMMENT_LIMIT",
}

export interface ScrapedUser {
  id: string;
  handle: string;
  comment: string;
  scrapedAt: string;
  profileUrl: string;
  messageSent?: boolean;
  sentAt?: string;
  messageError?: string;
  customMessage?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  isDefault?: boolean;
}

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  source?: "dashboard" | "tiktok" | "background" | "popup";
}

export interface ScrapeProgress {
  current: number;
  total: number;
  newUsers: number;
  status: "scrolling" | "extracting" | "complete" | "error";
  message?: string;
}

export interface SendProgress {
  userId: string;
  status: "opening" | "typing" | "sending" | "complete" | "error";
  message?: string;
}

export interface BulkSendProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
  status: "running" | "complete" | "stopped" | "error";
}

export interface StorageData {
  users: ScrapedUser[];
  templates: MessageTemplate[];
  settings: {
    messageDelay: number;
    scrollDelay: number;
    maxMessagesPerHour: number;
  };
}

export const DEFAULT_SETTINGS: StorageData["settings"] = {
  messageDelay: 3000,
  scrollDelay: 1500,
  maxMessagesPerHour: 20,
};

export const DEFAULT_TEMPLATE: MessageTemplate = {
  id: "default",
  name: "Default",
  content: "Hey {{handle}}! Thanks for your comment: \"{{comment}}\"",
  isDefault: true,
};
