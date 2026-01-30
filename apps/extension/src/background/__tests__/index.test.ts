import { describe, it, expect, beforeEach, vi } from "vitest";
import { MessageType, ScrapedComment, ScrapedVideo } from "../../types";

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
}));

import * as convexApi from "../../utils/convex-api";

const mockedConvexApi = vi.mocked(convexApi);

const mockStorage: Record<string, unknown> = {};

const mockChromeStorage = {
  local: {
    get: vi.fn((keys: string | string[]) => {
      if (typeof keys === "string") {
        return Promise.resolve({ [keys]: mockStorage[keys] });
      }
      const result: Record<string, unknown> = {};
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
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
      keysArray.forEach((key) => delete mockStorage[key]);
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

const mockChromeAction = {
  setBadgeText: vi.fn(),
  setBadgeBackgroundColor: vi.fn(),
};

const mockChromeRuntime = {
  onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  onConnect: { addListener: vi.fn() },
  sendMessage: vi.fn(),
};

const mockChromeExtension = {
  getViews: vi.fn().mockReturnValue([]),
};

vi.stubGlobal("chrome", {
  storage: mockChromeStorage,
  tabs: mockChromeTabs,
  action: mockChromeAction,
  runtime: mockChromeRuntime,
  extension: mockChromeExtension,
});

import {
  getScrapedComments,
  removeScrapedComment,
  removeScrapedComments,
  updateScrapedComment,
  getVideos,
  removeVideo,
  removeVideos,
  getAccountHandle,
  saveAccountHandle,
  getCommentLimit,
  saveCommentLimit,
  getPostLimit,
  savePostLimit,
  getScrapingState,
} from "../../utils/storage";

type ExtensionMessage = {
  type: MessageType;
  payload?: unknown;
};

type MessageSender = chrome.runtime.MessageSender;

async function handleMessage(
  message: ExtensionMessage,
  _sender: MessageSender
): Promise<unknown> {
  switch (message.type) {
    case MessageType.GET_SCRAPED_COMMENTS: {
      const comments = await getScrapedComments();
      return { comments };
    }

    case MessageType.REMOVE_SCRAPED_COMMENT: {
      const { commentId } = message.payload as { commentId: string };
      await removeScrapedComment(commentId);
      return { success: true };
    }

    case MessageType.REMOVE_SCRAPED_COMMENTS: {
      const { commentIds } = message.payload as { commentIds: string[] };
      await removeScrapedComments(commentIds);
      return { success: true };
    }

    case MessageType.UPDATE_SCRAPED_COMMENT: {
      const { commentId, updates } = message.payload as {
        commentId: string;
        updates: Partial<ScrapedComment>;
      };
      await updateScrapedComment(commentId, updates);
      return { success: true };
    }

    case MessageType.OPEN_TIKTOK_TAB: {
      const tab = await chrome.tabs.create({
        url: "https://www.tiktok.com",
        active: true,
      });
      return { tabId: tab.id };
    }

    case MessageType.GET_TIKTOK_TAB: {
      const tabs = await chrome.tabs.query({
        url: "https://www.tiktok.com/*",
      });
      return { tab: tabs[0] || null };
    }

    case MessageType.CHECK_BRIDGE: {
      return { connected: true };
    }

    case MessageType.GET_SCRAPING_STATE: {
      const state = await getScrapingState();
      return { state };
    }

    case MessageType.GET_ACCOUNT_HANDLE: {
      const handle = await getAccountHandle();
      return { handle };
    }

    case MessageType.SAVE_ACCOUNT_HANDLE: {
      const { handle } = message.payload as { handle: string };
      await saveAccountHandle(handle);
      return { success: true };
    }

    case MessageType.GET_COMMENT_LIMIT: {
      const limit = await getCommentLimit();
      return { limit };
    }

    case MessageType.SAVE_COMMENT_LIMIT: {
      const { limit } = message.payload as { limit: number };
      await saveCommentLimit(limit);
      return { success: true };
    }

    case MessageType.GET_POST_LIMIT: {
      const limit = await getPostLimit();
      return { limit };
    }

    case MessageType.SAVE_POST_LIMIT: {
      const { limit } = message.payload as { limit: number };
      await savePostLimit(limit);
      return { success: true };
    }

    case MessageType.GET_STORED_VIDEOS: {
      const videos = await getVideos();
      return { videos };
    }

    case MessageType.REMOVE_VIDEO: {
      const { videoId } = message.payload as { videoId: string };
      await removeVideo(videoId);
      return { success: true };
    }

    case MessageType.REMOVE_VIDEOS: {
      const { videoIds } = message.payload as { videoIds: string[] };
      await removeVideos(videoIds);
      return { success: true };
    }

    default:
      return null;
  }
}

function createComment(overrides: Partial<ScrapedComment> = {}): ScrapedComment {
  return {
    id: `comment-${Date.now()}-${Math.random()}`,
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

describe("Background Message Handler", () => {
  const mockSender: MessageSender = { tab: { id: 1 } } as MessageSender;

  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
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
          payload: { commentId: "1", updates: { replySent: true, repliedAt: "2024-01-01" } },
        },
        mockSender
      );

      expect(result).toEqual({ success: true });
      expect(mockedConvexApi.updateComment).toHaveBeenCalledWith("1", {
        replySent: true,
        repliedAt: expect.any(Number),
      });
    });
  });

  describe("Tab Operations", () => {
    it("OPEN_TIKTOK_TAB creates a new tab", async () => {
      const result = await handleMessage(
        { type: MessageType.OPEN_TIKTOK_TAB },
        mockSender
      );

      expect(mockChromeTabs.create).toHaveBeenCalledWith({
        url: "https://www.tiktok.com",
        active: true,
      });
      expect(result).toEqual({ tabId: 1 });
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
