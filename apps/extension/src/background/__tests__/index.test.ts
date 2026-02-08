import { describe, it, expect, beforeEach, vi } from "vitest";
import { MessageType, ScrapedComment, ScrapedVideo } from "../../types";

const {
  mockStorage, mockChromeStorage, mockChromeTabs,
  mockChromeRuntime,
} = vi.hoisted(() => {
  const mockStorage: Record<string, unknown> = {};
  const mockChromeStorage = {
    local: {
      get: vi.fn((keys: string | string[]) => {
        if (typeof keys === "string") {
          return Promise.resolve({ [keys]: mockStorage[keys] });
        }
        const result: Record<string, unknown> = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((key: string) => {
          result[key] = mockStorage[key];
        });
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[]) => {
        const keysArray = typeof keys === "string" ? [keys] : keys;
        keysArray.forEach((key: string) => delete mockStorage[key]);
        return Promise.resolve();
      }),
    },
  };

  const mockChromeTabs = {
    create: vi.fn().mockResolvedValue({ id: 1, url: "https://www.tiktok.com" }),
    query: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    sendMessage: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
    onRemoved: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    get: vi.fn().mockResolvedValue({ id: 1, url: "https://www.tiktok.com" }),
  };

  const mockChromeRuntime = {
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onConnect: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    sendMessage: vi.fn(),
    getManifest: vi.fn().mockReturnValue({ version: "1.0.0" }),
  };

  globalThis.chrome = {
    storage: mockChromeStorage,
    tabs: mockChromeTabs,
    action: {
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn(),
    },
    runtime: mockChromeRuntime,
    extension: { getViews: vi.fn().mockReturnValue([]) },
    windows: { update: vi.fn().mockResolvedValue({}) },
    scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
    webRequest: { onCompleted: { addListener: vi.fn() } },
  } as unknown as typeof chrome;

  return { mockStorage, mockChromeStorage, mockChromeTabs, mockChromeRuntime };
});

vi.mock("../../utils/convex-api", () => ({
  fetchComments: vi.fn(),
  syncComments: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  deleteComments: vi.fn(),
  fetchVideos: vi.fn(),
  syncVideos: vi.fn(),
  updateVideo: vi.fn(),
  deleteVideo: vi.fn(),
  deleteVideos: vi.fn(),
  fetchIgnoreList: vi.fn(),
  addToIgnoreListRemote: vi.fn(),
  removeFromIgnoreListRemote: vi.fn(),
  fetchSettings: vi.fn(),
  updateSettings: vi.fn(),
  setAuthToken: vi.fn(),
}));

vi.mock("../../config/loader", () => ({
  loadConfig: vi.fn().mockResolvedValue({ version: "test" }),
  refreshConfig: vi.fn().mockResolvedValue({ version: "test" }),
  getLoadedConfig: vi.fn().mockReturnValue({
    version: "test",
    timeouts: { selectorWait: 5000, tabLoad: 10000, replyTimeout: 30000 },
    delays: { postReply: 1000 },
    limits: { contentScriptRetries: 3, contentScriptRetryDelay: 1000 },
  }),
}));

vi.mock("../../utils/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as convexApi from "../../utils/convex-api";

const mockedConvexApi = vi.mocked(convexApi);

import { handleMessage } from "../index";

function createComment(overrides: Partial<ScrapedComment> = {}): ScrapedComment {
  return {
    id: `comment-${Date.now()}-${Math.random()}`,
    tiktokUserId: "7023701638964954118",
    handle: "testuser",
    comment: "Test comment",
    scrapedAt: new Date().toISOString(),
    profileUrl: "https://tiktok.com/@testuser",
    ...overrides,
  };
}

function createVideo(overrides: Partial<ScrapedVideo> = {}): ScrapedVideo {
  return {
    id: `video-${Date.now()}-${Math.random()}`,
    videoId: `${Date.now()}`,
    thumbnailUrl: "https://example.com/thumb.jpg",
    videoUrl: "https://tiktok.com/@user/video/123",
    profileHandle: "testuser",
    order: 0,
    scrapedAt: new Date().toISOString(),
    ...overrides,
  };
}

const defaultSettings = {
  messageDelay: 2000,
  scrollDelay: 1000,
  commentLimit: 100,
  postLimit: 50,
  accountHandle: null as string | null,
};

const mockSender: chrome.runtime.MessageSender = { tab: { id: 1 } } as chrome.runtime.MessageSender;

describe("Background Message Handler", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
    mockChromeTabs.query.mockResolvedValue([]);
    mockedConvexApi.fetchSettings.mockResolvedValue({ ...defaultSettings });
  });

  describe("Comment Operations", () => {
    it("GET_SCRAPED_COMMENTS returns stored comments", async () => {
      const comments = [createComment({ id: "1" }), createComment({ id: "2" })];
      mockedConvexApi.fetchComments.mockResolvedValue(comments);

      const result = await handleMessage(
        { type: MessageType.GET_SCRAPED_COMMENTS },
        mockSender
      );

      expect(mockedConvexApi.fetchComments).toHaveBeenCalled();
      expect(result).toEqual({ comments });
    });

    it("GET_SCRAPED_COMMENTS returns empty array when no comments", async () => {
      mockedConvexApi.fetchComments.mockResolvedValue([]);

      const result = await handleMessage(
        { type: MessageType.GET_SCRAPED_COMMENTS },
        mockSender
      );

      expect(result).toEqual({ comments: [] });
    });

    it("REMOVE_SCRAPED_COMMENT removes a single comment", async () => {
      mockedConvexApi.deleteComment.mockResolvedValue(undefined);

      const result = await handleMessage(
        { type: MessageType.REMOVE_SCRAPED_COMMENT, payload: { commentId: "1" } },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.deleteComment).toHaveBeenCalledWith("1");
    });

    it("REMOVE_SCRAPED_COMMENTS removes multiple comments", async () => {
      mockedConvexApi.deleteComments.mockResolvedValue(undefined);

      const result = await handleMessage(
        { type: MessageType.REMOVE_SCRAPED_COMMENTS, payload: { commentIds: ["1", "3"] } },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.deleteComments).toHaveBeenCalledWith(["1", "3"]);
    });

    it("UPDATE_SCRAPED_COMMENT updates comment fields", async () => {
      mockedConvexApi.updateComment.mockResolvedValue(undefined);

      const result = await handleMessage(
        {
          type: MessageType.UPDATE_SCRAPED_COMMENT,
          payload: { commentId: "1", updates: { repliedTo: true, repliedAt: "2024-01-01" } },
        },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.updateComment).toHaveBeenCalledWith("1", {
        repliedTo: true,
        repliedAt: expect.any(Number),
      });
    });
  });

  describe("Tab Operations", () => {
    it("OPEN_TIKTOK_TAB creates a new tab with dashboard-adjacent index", async () => {
      const result = await handleMessage(
        { type: MessageType.OPEN_TIKTOK_TAB },
        mockSender
      );

      expect(mockChromeTabs.create).toHaveBeenCalledWith({
        url: "https://www.tiktok.com",
        active: true,
        index: undefined,
      });
      expect(result).toEqual({ tabId: 1 });
    });

    it("OPEN_TIKTOK_TAB positions tab next to dashboard when dashboard is open", async () => {
      mockChromeTabs.query.mockResolvedValueOnce([{ id: 5, index: 2 }]);

      await handleMessage(
        { type: MessageType.OPEN_TIKTOK_TAB },
        mockSender
      );

      expect(mockChromeTabs.create).toHaveBeenCalledWith({
        url: "https://www.tiktok.com",
        active: true,
        index: 3,
      });
    });

    it("GET_TIKTOK_TAB returns existing TikTok tab", async () => {
      const mockTab = { id: 5, url: "https://www.tiktok.com/@user" };
      mockChromeTabs.query.mockResolvedValueOnce([mockTab]);

      const result = await handleMessage(
        { type: MessageType.GET_TIKTOK_TAB },
        mockSender
      );

      expect(mockChromeTabs.query).toHaveBeenCalledWith({
        url: "https://www.tiktok.com/*",
      });
      expect(result).toEqual({ tab: mockTab });
    });

    it("GET_TIKTOK_TAB returns null when no TikTok tab exists", async () => {
      mockChromeTabs.query.mockResolvedValueOnce([]);

      const result = await handleMessage(
        { type: MessageType.GET_TIKTOK_TAB },
        mockSender
      );

      expect(result).toEqual({ tab: null });
    });
  });

  describe("Bridge Check", () => {
    it("CHECK_BRIDGE returns connected status", async () => {
      const result = await handleMessage(
        { type: MessageType.CHECK_BRIDGE },
        mockSender
      );

      expect(result).toEqual({ connected: true });
    });

    it("CHECK_EXTENSION returns installed status", async () => {
      const result = await handleMessage(
        { type: MessageType.CHECK_EXTENSION },
        mockSender
      );

      expect(result).toEqual({ installed: true });
    });
  });

  describe("Account Handle Operations", () => {
    it("GET_ACCOUNT_HANDLE returns stored handle", async () => {
      mockedConvexApi.fetchSettings.mockResolvedValue({
        ...defaultSettings,
        accountHandle: "myhandle",
      });

      const result = await handleMessage(
        { type: MessageType.GET_ACCOUNT_HANDLE },
        mockSender
      );

      expect(result).toEqual({ handle: "myhandle" });
    });

    it("GET_ACCOUNT_HANDLE returns null when no handle set", async () => {
      mockedConvexApi.fetchSettings.mockResolvedValue({
        ...defaultSettings,
        accountHandle: null,
      });

      const result = await handleMessage(
        { type: MessageType.GET_ACCOUNT_HANDLE },
        mockSender
      );

      expect(result).toEqual({ handle: null });
    });

    it("SAVE_ACCOUNT_HANDLE saves the handle", async () => {
      mockedConvexApi.updateSettings.mockResolvedValue(undefined);

      const result = await handleMessage(
        { type: MessageType.SAVE_ACCOUNT_HANDLE, payload: { handle: "@newhandle" } },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.updateSettings).toHaveBeenCalledWith({
        accountHandle: "newhandle",
      });
    });
  });

  describe("Limit Operations", () => {
    it("GET_COMMENT_LIMIT returns stored limit", async () => {
      mockedConvexApi.fetchSettings.mockResolvedValue({
        ...defaultSettings,
        commentLimit: 200,
      });

      const result = await handleMessage(
        { type: MessageType.GET_COMMENT_LIMIT },
        mockSender
      );

      expect(result).toEqual({ limit: 200 });
    });

    it("GET_COMMENT_LIMIT returns default when not set", async () => {
      mockedConvexApi.fetchSettings.mockResolvedValue(defaultSettings);

      const result = await handleMessage(
        { type: MessageType.GET_COMMENT_LIMIT },
        mockSender
      );

      expect(result).toEqual({ limit: 100 });
    });

    it("SAVE_COMMENT_LIMIT saves the limit", async () => {
      mockedConvexApi.updateSettings.mockResolvedValue(undefined);

      const result = await handleMessage(
        { type: MessageType.SAVE_COMMENT_LIMIT, payload: { limit: 500 } },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.updateSettings).toHaveBeenCalledWith({
        commentLimit: 500,
      });
    });

    it("GET_POST_LIMIT returns stored limit", async () => {
      mockedConvexApi.fetchSettings.mockResolvedValue({
        ...defaultSettings,
        postLimit: 25,
      });

      const result = await handleMessage(
        { type: MessageType.GET_POST_LIMIT },
        mockSender
      );

      expect(result).toEqual({ limit: 25 });
    });

    it("SAVE_POST_LIMIT saves the limit", async () => {
      mockedConvexApi.updateSettings.mockResolvedValue(undefined);

      const result = await handleMessage(
        { type: MessageType.SAVE_POST_LIMIT, payload: { limit: 75 } },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.updateSettings).toHaveBeenCalledWith({
        postLimit: 75,
      });
    });
  });

  describe("Video Operations", () => {
    it("GET_STORED_VIDEOS returns stored videos", async () => {
      const videos = [createVideo({ videoId: "123" })];
      mockedConvexApi.fetchVideos.mockResolvedValue(videos);

      const result = await handleMessage(
        { type: MessageType.GET_STORED_VIDEOS },
        mockSender
      );

      expect(mockedConvexApi.fetchVideos).toHaveBeenCalled();
      expect(result).toEqual({ videos });
    });

    it("REMOVE_VIDEO removes a single video", async () => {
      mockedConvexApi.deleteVideo.mockResolvedValue(undefined);

      const result = await handleMessage(
        { type: MessageType.REMOVE_VIDEO, payload: { videoId: "123" } },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.deleteVideo).toHaveBeenCalledWith("123");
    });

    it("REMOVE_VIDEOS removes multiple videos", async () => {
      mockedConvexApi.deleteVideos.mockResolvedValue(undefined);

      const result = await handleMessage(
        { type: MessageType.REMOVE_VIDEOS, payload: { videoIds: ["1", "3"] } },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.deleteVideos).toHaveBeenCalledWith(["1", "3"]);
    });
  });

  describe("Ignore List Operations", () => {
    it("GET_IGNORE_LIST returns ignore list", async () => {
      const ignoreList = [{ text: "spam", addedAt: "2024-01-01T00:00:00.000Z" }];
      mockedConvexApi.fetchIgnoreList.mockResolvedValue(ignoreList);

      const result = await handleMessage(
        { type: MessageType.GET_IGNORE_LIST },
        mockSender
      );

      expect(result).toEqual({ ignoreList });
    });

    it("ADD_TO_IGNORE_LIST adds text to ignore list", async () => {
      mockedConvexApi.addToIgnoreListRemote.mockResolvedValue(undefined);

      const result = await handleMessage(
        { type: MessageType.ADD_TO_IGNORE_LIST, payload: { text: "spam" } },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.addToIgnoreListRemote).toHaveBeenCalledWith("spam");
    });

    it("REMOVE_FROM_IGNORE_LIST removes text from ignore list", async () => {
      mockedConvexApi.removeFromIgnoreListRemote.mockResolvedValue(undefined);

      const result = await handleMessage(
        { type: MessageType.REMOVE_FROM_IGNORE_LIST, payload: { text: "spam" } },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.removeFromIgnoreListRemote).toHaveBeenCalledWith("spam");
    });
  });

  describe("Scraping State", () => {
    it("GET_SCRAPING_STATE returns current state", async () => {
      const state = {
        isActive: true,
        isPaused: false,
        videoId: "123",
        tabId: 1,
        commentsFound: 50,
        status: "scraping",
        message: "Scraping...",
      };
      mockStorage["tokative_scraping_state"] = state;

      const result = await handleMessage(
        { type: MessageType.GET_SCRAPING_STATE },
        mockSender
      );

      expect(result).toEqual({ state });
    });

    it("GET_SCRAPING_STATE returns default when not set", async () => {
      const result = await handleMessage(
        { type: MessageType.GET_SCRAPING_STATE },
        mockSender
      );

      expect(result).toEqual({
        state: {
          isActive: false,
          isPaused: false,
          videoId: null,
          tabId: null,
          commentsFound: 0,
          status: "complete",
          message: "",
        },
      });
    });
  });

  describe("Forward to Dashboard", () => {
    it("forwards REPLY_COMMENT_PROGRESS to dashboard", async () => {
      const result = await handleMessage(
        {
          type: MessageType.REPLY_COMMENT_PROGRESS,
          payload: { commentId: "1", status: "replying", message: "Typing..." },
        },
        mockSender
      );

      expect(result).toEqual({ success: true });
    });

    it("forwards COMMENTS_UPDATED to dashboard", async () => {
      const result = await handleMessage(
        { type: MessageType.COMMENTS_UPDATED },
        mockSender
      );

      expect(result).toEqual({ success: true });
    });
  });

  describe("Config Operations", () => {
    it("GET_CONFIG returns loaded config", async () => {
      const result = await handleMessage(
        { type: MessageType.GET_CONFIG },
        mockSender
      );

      expect(result).toHaveProperty("config");
    });
  });

  describe("Unknown Messages", () => {
    it("returns null for unknown message types", async () => {
      const result = await handleMessage(
        { type: "UNKNOWN_TYPE" as MessageType },
        mockSender
      );

      expect(result).toBeNull();
    });
  });
});
