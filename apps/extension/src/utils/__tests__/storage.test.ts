import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScrapedComment, ScrapedVideo, IgnoreListEntry } from "../../types";

vi.mock("../convex-api", () => ({
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

import * as convexApi from "../convex-api";

const mockStorage: Record<string, unknown> = {};

const mockChromeStorage = {
  local: {
    get: vi.fn((keys: string | string[]) => {
      if (typeof keys === "string") {
        return Promise.resolve({ [keys]: mockStorage[keys] });
      }
      const result: Record<string, unknown> = {};
      keys.forEach((key) => {
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

vi.stubGlobal("chrome", { storage: mockChromeStorage });

import {
  getScrapedComments,
  addScrapedComments,
  updateScrapedComment,
  removeScrapedComment,
  removeScrapedComments,
  getVideos,
  addVideos,
  updateVideo,
  removeVideo,
  removeVideos,
  getAccountHandle,
  saveAccountHandle,
  getCommentLimit,
  saveCommentLimit,
  getPostLimit,
  savePostLimit,
  getScrapingState,
  saveScrapingState,
  clearScrapingState,
  getIgnoreList,
  addToIgnoreList,
  removeFromIgnoreList,
} from "../storage";

const mockedConvexApi = vi.mocked(convexApi);

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

describe("Comment Storage (Convex-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getScrapedComments", () => {
    it("fetches comments from Convex", async () => {
      const mockComments = [createComment({ id: "1" }), createComment({ id: "2" })];
      mockedConvexApi.fetchComments.mockResolvedValue(mockComments);

      const comments = await getScrapedComments();

      expect(mockedConvexApi.fetchComments).toHaveBeenCalled();
      expect(comments).toEqual(mockComments);
    });

    it("returns empty array when no comments", async () => {
      mockedConvexApi.fetchComments.mockResolvedValue([]);

      const comments = await getScrapedComments();

      expect(comments).toEqual([]);
    });
  });

  describe("addScrapedComments", () => {
    it("syncs comments to Convex with ignore list", async () => {
      const ignoreList: IgnoreListEntry[] = [
        { text: "spam", addedAt: "2024-01-01T00:00:00.000Z" },
      ];
      mockedConvexApi.fetchIgnoreList.mockResolvedValue(ignoreList);
      mockedConvexApi.syncComments.mockResolvedValue({
        new: 2,
        preexisting: 0,
        ignored: 1,
      });

      const newComments = [createComment({ id: "1" }), createComment({ id: "2" })];
      const result = await addScrapedComments(newComments);

      expect(mockedConvexApi.fetchIgnoreList).toHaveBeenCalled();
      expect(mockedConvexApi.syncComments).toHaveBeenCalledWith(newComments, ["spam"]);
      expect(result).toEqual({ new: 2, preexisting: 0, ignored: 1 });
    });
  });

  describe("updateScrapedComment", () => {
    it("updates comment in Convex", async () => {
      mockedConvexApi.updateComment.mockResolvedValue(undefined);

      await updateScrapedComment("comment-1", { replySent: true, repliedAt: "2024-01-01" });

      expect(mockedConvexApi.updateComment).toHaveBeenCalledWith("comment-1", {
        replySent: true,
        repliedAt: expect.any(Number),
      });
    });

    it("does not call Convex when no updates provided", async () => {
      await updateScrapedComment("comment-1", {});

      expect(mockedConvexApi.updateComment).not.toHaveBeenCalled();
    });
  });

  describe("removeScrapedComment", () => {
    it("deletes comment from Convex", async () => {
      mockedConvexApi.deleteComment.mockResolvedValue(undefined);

      await removeScrapedComment("comment-1");

      expect(mockedConvexApi.deleteComment).toHaveBeenCalledWith("comment-1");
    });
  });

  describe("removeScrapedComments", () => {
    it("deletes multiple comments from Convex", async () => {
      mockedConvexApi.deleteComments.mockResolvedValue(undefined);

      await removeScrapedComments(["1", "2", "3"]);

      expect(mockedConvexApi.deleteComments).toHaveBeenCalledWith(["1", "2", "3"]);
    });
  });
});

describe("Video Storage (Convex-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getVideos", () => {
    it("fetches videos from Convex", async () => {
      const mockVideos = [createVideo({ videoId: "123" })];
      mockedConvexApi.fetchVideos.mockResolvedValue(mockVideos);

      const videos = await getVideos();

      expect(mockedConvexApi.fetchVideos).toHaveBeenCalled();
      expect(videos).toEqual(mockVideos);
    });
  });

  describe("addVideos", () => {
    it("syncs videos to Convex and returns stored count", async () => {
      mockedConvexApi.syncVideos.mockResolvedValue({ stored: 2, duplicates: 1 });

      const newVideos = [createVideo({ videoId: "1" }), createVideo({ videoId: "2" })];
      const added = await addVideos(newVideos);

      expect(mockedConvexApi.syncVideos).toHaveBeenCalledWith(newVideos);
      expect(added).toBe(2);
    });
  });

  describe("updateVideo", () => {
    it("updates video commentsScraped in Convex", async () => {
      mockedConvexApi.updateVideo.mockResolvedValue(undefined);

      await updateVideo("video-123", { commentsScraped: true });

      expect(mockedConvexApi.updateVideo).toHaveBeenCalledWith("video-123", {
        commentsScraped: true,
      });
    });

    it("does not call Convex when commentsScraped not provided", async () => {
      await updateVideo("video-123", { order: 5 });

      expect(mockedConvexApi.updateVideo).not.toHaveBeenCalled();
    });
  });

  describe("removeVideo", () => {
    it("deletes video from Convex", async () => {
      mockedConvexApi.deleteVideo.mockResolvedValue(undefined);

      await removeVideo("video-123");

      expect(mockedConvexApi.deleteVideo).toHaveBeenCalledWith("video-123");
    });
  });

  describe("removeVideos", () => {
    it("deletes multiple videos from Convex", async () => {
      mockedConvexApi.deleteVideos.mockResolvedValue(undefined);

      await removeVideos(["1", "2", "3"]);

      expect(mockedConvexApi.deleteVideos).toHaveBeenCalledWith(["1", "2", "3"]);
    });
  });
});

describe("Account Handle Storage (Convex-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAccountHandle", () => {
    it("fetches account handle from Convex settings", async () => {
      mockedConvexApi.fetchSettings.mockResolvedValue({
        messageDelay: 2000,
        scrollDelay: 1000,
        commentLimit: 100,
        postLimit: 50,
        accountHandle: "myhandle",
      });

      const handle = await getAccountHandle();

      expect(mockedConvexApi.fetchSettings).toHaveBeenCalled();
      expect(handle).toBe("myhandle");
    });

    it("returns null when no handle set", async () => {
      mockedConvexApi.fetchSettings.mockResolvedValue({
        messageDelay: 2000,
        scrollDelay: 1000,
        commentLimit: 100,
        postLimit: 50,
        accountHandle: null,
      });

      const handle = await getAccountHandle();

      expect(handle).toBeNull();
    });
  });

  describe("saveAccountHandle", () => {
    it("saves handle to Convex settings", async () => {
      mockedConvexApi.updateSettings.mockResolvedValue(undefined);

      await saveAccountHandle("myhandle");

      expect(mockedConvexApi.updateSettings).toHaveBeenCalledWith({
        accountHandle: "myhandle",
      });
    });

    it("strips @ prefix from handle", async () => {
      mockedConvexApi.updateSettings.mockResolvedValue(undefined);

      await saveAccountHandle("@myhandle");

      expect(mockedConvexApi.updateSettings).toHaveBeenCalledWith({
        accountHandle: "myhandle",
      });
    });
  });
});

describe("Limit Storage (Convex-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCommentLimit", () => {
    it("fetches comment limit from Convex settings", async () => {
      mockedConvexApi.fetchSettings.mockResolvedValue({
        messageDelay: 2000,
        scrollDelay: 1000,
        commentLimit: 200,
        postLimit: 50,
        accountHandle: null,
      });

      const limit = await getCommentLimit();

      expect(mockedConvexApi.fetchSettings).toHaveBeenCalled();
      expect(limit).toBe(200);
    });
  });

  describe("saveCommentLimit", () => {
    it("saves comment limit to Convex settings", async () => {
      mockedConvexApi.updateSettings.mockResolvedValue(undefined);

      await saveCommentLimit(300);

      expect(mockedConvexApi.updateSettings).toHaveBeenCalledWith({
        commentLimit: 300,
      });
    });
  });

  describe("getPostLimit", () => {
    it("fetches post limit from Convex settings", async () => {
      mockedConvexApi.fetchSettings.mockResolvedValue({
        messageDelay: 2000,
        scrollDelay: 1000,
        commentLimit: 100,
        postLimit: 75,
        accountHandle: null,
      });

      const limit = await getPostLimit();

      expect(limit).toBe(75);
    });
  });

  describe("savePostLimit", () => {
    it("saves post limit to Convex settings", async () => {
      mockedConvexApi.updateSettings.mockResolvedValue(undefined);

      await savePostLimit(100);

      expect(mockedConvexApi.updateSettings).toHaveBeenCalledWith({
        postLimit: 100,
      });
    });
  });
});

describe("Ignore List Storage (Convex-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getIgnoreList", () => {
    it("fetches ignore list from Convex", async () => {
      const entries: IgnoreListEntry[] = [
        { text: "spam comment", addedAt: "2024-01-01T00:00:00.000Z" },
      ];
      mockedConvexApi.fetchIgnoreList.mockResolvedValue(entries);

      const ignoreList = await getIgnoreList();

      expect(mockedConvexApi.fetchIgnoreList).toHaveBeenCalled();
      expect(ignoreList).toEqual(entries);
    });
  });

  describe("addToIgnoreList", () => {
    it("adds text to Convex ignore list", async () => {
      mockedConvexApi.addToIgnoreListRemote.mockResolvedValue(undefined);

      await addToIgnoreList("spam comment");

      expect(mockedConvexApi.addToIgnoreListRemote).toHaveBeenCalledWith("spam comment");
    });
  });

  describe("removeFromIgnoreList", () => {
    it("removes text from Convex ignore list", async () => {
      mockedConvexApi.removeFromIgnoreListRemote.mockResolvedValue(undefined);

      await removeFromIgnoreList("spam comment");

      expect(mockedConvexApi.removeFromIgnoreListRemote).toHaveBeenCalledWith("spam comment");
    });
  });
});

describe("Scraping State Storage (Local)", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe("getScrapingState", () => {
    it("returns default state when not set", async () => {
      const state = await getScrapingState();
      expect(state).toEqual({
        isActive: false,
        isPaused: false,
        videoId: null,
        tabId: null,
        commentsFound: 0,
        status: "complete",
        message: "",
      });
    });

    it("returns stored state", async () => {
      const storedState = {
        isActive: true,
        isPaused: false,
        videoId: "123",
        tabId: 1,
        commentsFound: 50,
        status: "scraping",
        message: "Scraping...",
      };
      mockStorage["tokative_scraping_state"] = storedState;

      const state = await getScrapingState();
      expect(state).toEqual(storedState);
    });
  });

  describe("saveScrapingState", () => {
    it("merges partial state with existing state", async () => {
      mockStorage["tokative_scraping_state"] = {
        isActive: true,
        isPaused: false,
        videoId: "123",
        tabId: 1,
        commentsFound: 50,
        status: "scraping",
        message: "Scraping...",
      };

      await saveScrapingState({ commentsFound: 100, message: "Almost done" });

      const stored = mockStorage["tokative_scraping_state"] as Record<string, unknown>;
      expect(stored.commentsFound).toBe(100);
      expect(stored.message).toBe("Almost done");
      expect(stored.isActive).toBe(true);
      expect(stored.videoId).toBe("123");
    });
  });

  describe("clearScrapingState", () => {
    it("resets to default state", async () => {
      mockStorage["tokative_scraping_state"] = {
        isActive: true,
        commentsFound: 100,
      };

      await clearScrapingState();

      const stored = mockStorage["tokative_scraping_state"] as Record<string, unknown>;
      expect(stored.isActive).toBe(false);
      expect(stored.commentsFound).toBe(0);
    });
  });
});
