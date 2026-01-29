import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getScrapedComments,
  saveScrapedComments,
  addScrapedComments,
  updateScrapedComment,
  removeScrapedComment,
  removeScrapedComments,
  getVideos,
  saveVideos,
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
import { ScrapedComment, ScrapedVideo, IgnoreListEntry } from "../../types";

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

describe("Comment Storage", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe("getScrapedComments", () => {
    it("returns empty array when no comments exist", async () => {
      const comments = await getScrapedComments();
      expect(comments).toEqual([]);
    });

    it("returns stored comments", async () => {
      const testComments = [createComment({ id: "1" }), createComment({ id: "2" })];
      mockStorage["tiktok_buddy_scraped_comments"] = testComments;

      const comments = await getScrapedComments();
      expect(comments).toEqual(testComments);
    });
  });

  describe("saveScrapedComments", () => {
    it("saves comments to storage", async () => {
      const testComments = [createComment({ id: "1" })];
      await saveScrapedComments(testComments);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        tiktok_buddy_scraped_comments: testComments,
      });
    });
  });

  describe("addScrapedComments", () => {
    it("adds new comments to existing ones", async () => {
      const existing = [createComment({ id: "1", handle: "user1", comment: "First" })];
      mockStorage["tiktok_buddy_scraped_comments"] = existing;

      const newComments = [createComment({ id: "2", handle: "user2", comment: "Second" })];
      const result = await addScrapedComments(newComments);

      expect(result.stored).toBe(1);
      expect(mockStorage["tiktok_buddy_scraped_comments"]).toHaveLength(2);
    });

    it("deduplicates by comment ID", async () => {
      const existing = [createComment({ id: "1", handle: "user1", comment: "First" })];
      mockStorage["tiktok_buddy_scraped_comments"] = existing;

      const newComments = [createComment({ id: "1", handle: "user1", comment: "First" })];
      const result = await addScrapedComments(newComments);

      expect(result.stored).toBe(0);
      expect(result.duplicates).toBe(1);
    });

    it("deduplicates by handle:comment key", async () => {
      const existing = [createComment({ id: "1", handle: "user1", comment: "Same comment" })];
      mockStorage["tiktok_buddy_scraped_comments"] = existing;

      const newComments = [createComment({ id: "different-id", handle: "user1", comment: "Same comment" })];
      const result = await addScrapedComments(newComments);

      expect(result.stored).toBe(0);
      expect(result.duplicates).toBe(1);
    });

    it("adds comments with different handle:comment combinations", async () => {
      const existing = [createComment({ id: "1", handle: "user1", comment: "Comment A" })];
      mockStorage["tiktok_buddy_scraped_comments"] = existing;

      const newComments = [
        createComment({ id: "2", handle: "user1", comment: "Comment B" }),
        createComment({ id: "3", handle: "user2", comment: "Comment A" }),
      ];
      const result = await addScrapedComments(newComments);

      expect(result.stored).toBe(2);
    });
  });

  describe("updateScrapedComment", () => {
    it("updates an existing comment", async () => {
      const comments = [createComment({ id: "1", replySent: false })];
      mockStorage["tiktok_buddy_scraped_comments"] = comments;

      await updateScrapedComment("1", { replySent: true, repliedAt: "2024-01-01" });

      const stored = mockStorage["tiktok_buddy_scraped_comments"] as ScrapedComment[];
      expect(stored[0].replySent).toBe(true);
      expect(stored[0].repliedAt).toBe("2024-01-01");
    });

    it("does nothing if comment not found", async () => {
      const comments = [createComment({ id: "1" })];
      mockStorage["tiktok_buddy_scraped_comments"] = comments;

      await updateScrapedComment("nonexistent", { replySent: true });

      expect(mockChromeStorage.local.set).not.toHaveBeenCalled();
    });
  });

  describe("removeScrapedComment", () => {
    it("removes a single comment by ID", async () => {
      const comments = [createComment({ id: "1" }), createComment({ id: "2" })];
      mockStorage["tiktok_buddy_scraped_comments"] = comments;

      await removeScrapedComment("1");

      const stored = mockStorage["tiktok_buddy_scraped_comments"] as ScrapedComment[];
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("2");
    });
  });

  describe("removeScrapedComments", () => {
    it("removes multiple comments by IDs", async () => {
      const comments = [
        createComment({ id: "1" }),
        createComment({ id: "2" }),
        createComment({ id: "3" }),
      ];
      mockStorage["tiktok_buddy_scraped_comments"] = comments;

      await removeScrapedComments(["1", "3"]);

      const stored = mockStorage["tiktok_buddy_scraped_comments"] as ScrapedComment[];
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("2");
    });
  });
});

describe("Video Storage", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe("getVideos", () => {
    it("returns empty array when no videos exist", async () => {
      const videos = await getVideos();
      expect(videos).toEqual([]);
    });

    it("returns stored videos", async () => {
      const testVideos = [createVideo({ videoId: "123" })];
      mockStorage["tiktok_buddy_videos"] = testVideos;

      const videos = await getVideos();
      expect(videos).toEqual(testVideos);
    });
  });

  describe("addVideos", () => {
    it("adds new videos and deduplicates by videoId", async () => {
      const existing = [createVideo({ videoId: "123" })];
      mockStorage["tiktok_buddy_videos"] = existing;

      const newVideos = [
        createVideo({ videoId: "123" }),
        createVideo({ videoId: "456" }),
      ];
      const added = await addVideos(newVideos);

      expect(added).toBe(1);
      expect(mockStorage["tiktok_buddy_videos"]).toHaveLength(2);
    });
  });

  describe("updateVideo", () => {
    it("updates an existing video", async () => {
      const videos = [createVideo({ videoId: "123", commentsScraped: false })];
      mockStorage["tiktok_buddy_videos"] = videos;

      await updateVideo("123", { commentsScraped: true });

      const stored = mockStorage["tiktok_buddy_videos"] as ScrapedVideo[];
      expect(stored[0].commentsScraped).toBe(true);
    });
  });

  describe("removeVideo", () => {
    it("removes a single video by ID", async () => {
      const videos = [createVideo({ videoId: "123" }), createVideo({ videoId: "456" })];
      mockStorage["tiktok_buddy_videos"] = videos;

      await removeVideo("123");

      const stored = mockStorage["tiktok_buddy_videos"] as ScrapedVideo[];
      expect(stored).toHaveLength(1);
      expect(stored[0].videoId).toBe("456");
    });
  });

  describe("removeVideos", () => {
    it("removes multiple videos by IDs", async () => {
      const videos = [
        createVideo({ videoId: "1" }),
        createVideo({ videoId: "2" }),
        createVideo({ videoId: "3" }),
      ];
      mockStorage["tiktok_buddy_videos"] = videos;

      await removeVideos(["1", "3"]);

      const stored = mockStorage["tiktok_buddy_videos"] as ScrapedVideo[];
      expect(stored).toHaveLength(1);
      expect(stored[0].videoId).toBe("2");
    });
  });
});

describe("Account Handle Storage", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe("getAccountHandle", () => {
    it("returns null when no handle is set", async () => {
      const handle = await getAccountHandle();
      expect(handle).toBeNull();
    });

    it("returns stored handle", async () => {
      mockStorage["tiktok_buddy_account_handle"] = "myhandle";
      const handle = await getAccountHandle();
      expect(handle).toBe("myhandle");
    });
  });

  describe("saveAccountHandle", () => {
    it("saves handle without @ prefix", async () => {
      await saveAccountHandle("myhandle");
      expect(mockStorage["tiktok_buddy_account_handle"]).toBe("myhandle");
    });

    it("strips @ prefix from handle", async () => {
      await saveAccountHandle("@myhandle");
      expect(mockStorage["tiktok_buddy_account_handle"]).toBe("myhandle");
    });
  });
});

describe("Limit Storage", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe("getCommentLimit", () => {
    it("returns default value when not set", async () => {
      const limit = await getCommentLimit();
      expect(limit).toBe(100);
    });

    it("returns stored limit", async () => {
      mockStorage["tiktok_buddy_comment_limit"] = 50;
      const limit = await getCommentLimit();
      expect(limit).toBe(50);
    });
  });

  describe("saveCommentLimit", () => {
    it("saves comment limit", async () => {
      await saveCommentLimit(200);
      expect(mockStorage["tiktok_buddy_comment_limit"]).toBe(200);
    });
  });

  describe("getPostLimit", () => {
    it("returns default value when not set", async () => {
      const limit = await getPostLimit();
      expect(limit).toBe(50);
    });

    it("returns stored limit", async () => {
      mockStorage["tiktok_buddy_post_limit"] = 25;
      const limit = await getPostLimit();
      expect(limit).toBe(25);
    });
  });

  describe("savePostLimit", () => {
    it("saves post limit", async () => {
      await savePostLimit(100);
      expect(mockStorage["tiktok_buddy_post_limit"]).toBe(100);
    });
  });
});

describe("Scraping State Storage", () => {
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
      mockStorage["tiktok_buddy_scraping_state"] = storedState;

      const state = await getScrapingState();
      expect(state).toEqual(storedState);
    });
  });

  describe("saveScrapingState", () => {
    it("merges partial state with existing state", async () => {
      mockStorage["tiktok_buddy_scraping_state"] = {
        isActive: true,
        isPaused: false,
        videoId: "123",
        tabId: 1,
        commentsFound: 50,
        status: "scraping",
        message: "Scraping...",
      };

      await saveScrapingState({ commentsFound: 100, message: "Almost done" });

      const stored = mockStorage["tiktok_buddy_scraping_state"] as Record<string, unknown>;
      expect(stored.commentsFound).toBe(100);
      expect(stored.message).toBe("Almost done");
      expect(stored.isActive).toBe(true);
      expect(stored.videoId).toBe("123");
    });
  });

  describe("clearScrapingState", () => {
    it("resets to default state", async () => {
      mockStorage["tiktok_buddy_scraping_state"] = {
        isActive: true,
        commentsFound: 100,
      };

      await clearScrapingState();

      const stored = mockStorage["tiktok_buddy_scraping_state"] as Record<string, unknown>;
      expect(stored.isActive).toBe(false);
      expect(stored.commentsFound).toBe(0);
    });
  });
});

describe("Ignore List Storage", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe("getIgnoreList", () => {
    it("returns empty array when no ignore list exists", async () => {
      const ignoreList = await getIgnoreList();
      expect(ignoreList).toEqual([]);
    });

    it("returns stored ignore list entries", async () => {
      const entries: IgnoreListEntry[] = [
        { text: "spam comment", addedAt: "2024-01-01T00:00:00.000Z" },
        { text: "another spam", addedAt: "2024-01-02T00:00:00.000Z" },
      ];
      mockStorage["tiktok_buddy_ignore_list"] = entries;

      const ignoreList = await getIgnoreList();
      expect(ignoreList).toEqual(entries);
    });
  });

  describe("addToIgnoreList", () => {
    it("adds new text to empty ignore list", async () => {
      await addToIgnoreList("spam comment");

      const stored = mockStorage["tiktok_buddy_ignore_list"] as IgnoreListEntry[];
      expect(stored).toHaveLength(1);
      expect(stored[0].text).toBe("spam comment");
    });

    it("adds new text to existing ignore list", async () => {
      mockStorage["tiktok_buddy_ignore_list"] = [
        { text: "existing spam", addedAt: "2024-01-01T00:00:00.000Z" },
      ];

      await addToIgnoreList("new spam");

      const stored = mockStorage["tiktok_buddy_ignore_list"] as IgnoreListEntry[];
      expect(stored).toHaveLength(2);
      expect(stored[1].text).toBe("new spam");
    });

    it("does not add duplicate text", async () => {
      mockStorage["tiktok_buddy_ignore_list"] = [
        { text: "spam comment", addedAt: "2024-01-01T00:00:00.000Z" },
      ];

      await addToIgnoreList("spam comment");

      const stored = mockStorage["tiktok_buddy_ignore_list"] as IgnoreListEntry[];
      expect(stored).toHaveLength(1);
    });

    it("stores addedAt timestamp", async () => {
      const before = new Date().toISOString();
      await addToIgnoreList("spam comment");
      const after = new Date().toISOString();

      const stored = mockStorage["tiktok_buddy_ignore_list"] as IgnoreListEntry[];
      expect(stored[0].addedAt).toBeDefined();
      expect(stored[0].addedAt >= before).toBe(true);
      expect(stored[0].addedAt <= after).toBe(true);
    });
  });

  describe("removeFromIgnoreList", () => {
    it("removes text from ignore list", async () => {
      mockStorage["tiktok_buddy_ignore_list"] = [
        { text: "spam 1", addedAt: "2024-01-01T00:00:00.000Z" },
        { text: "spam 2", addedAt: "2024-01-02T00:00:00.000Z" },
      ];

      await removeFromIgnoreList("spam 1");

      const stored = mockStorage["tiktok_buddy_ignore_list"] as IgnoreListEntry[];
      expect(stored).toHaveLength(1);
      expect(stored[0].text).toBe("spam 2");
    });

    it("does nothing if text not in list", async () => {
      mockStorage["tiktok_buddy_ignore_list"] = [
        { text: "spam 1", addedAt: "2024-01-01T00:00:00.000Z" },
      ];

      await removeFromIgnoreList("nonexistent");

      const stored = mockStorage["tiktok_buddy_ignore_list"] as IgnoreListEntry[];
      expect(stored).toHaveLength(1);
    });
  });

  describe("addScrapedComments with ignore list", () => {
    it("filters out comments matching ignored text", async () => {
      mockStorage["tiktok_buddy_ignore_list"] = [
        { text: "spam comment", addedAt: "2024-01-01T00:00:00.000Z" },
      ];

      const newComments = [
        createComment({ id: "1", comment: "spam comment" }),
        createComment({ id: "2", comment: "good comment" }),
      ];

      const result = await addScrapedComments(newComments);

      expect(result.stored).toBe(1);
      expect(result.ignored).toBe(1);
      const stored = mockStorage["tiktok_buddy_scraped_comments"] as ScrapedComment[];
      expect(stored).toHaveLength(1);
      expect(stored[0].comment).toBe("good comment");
    });

    it("allows comments not in ignore list", async () => {
      mockStorage["tiktok_buddy_ignore_list"] = [
        { text: "spam comment", addedAt: "2024-01-01T00:00:00.000Z" },
      ];

      const newComments = [
        createComment({ id: "1", comment: "legitimate comment" }),
      ];

      const result = await addScrapedComments(newComments);

      expect(result.stored).toBe(1);
      expect(result.ignored).toBe(0);
    });

    it("filters by exact text match (case-sensitive)", async () => {
      mockStorage["tiktok_buddy_ignore_list"] = [
        { text: "Spam Comment", addedAt: "2024-01-01T00:00:00.000Z" },
      ];

      const newComments = [
        createComment({ id: "1", comment: "spam comment" }),
        createComment({ id: "2", comment: "Spam Comment" }),
      ];

      const result = await addScrapedComments(newComments);

      expect(result.stored).toBe(1);
      expect(result.ignored).toBe(1);
      const stored = mockStorage["tiktok_buddy_scraped_comments"] as ScrapedComment[];
      expect(stored[0].comment).toBe("spam comment");
    });

    it("still deduplicates by ID and handle:comment after filtering", async () => {
      mockStorage["tiktok_buddy_ignore_list"] = [
        { text: "spam", addedAt: "2024-01-01T00:00:00.000Z" },
      ];
      mockStorage["tiktok_buddy_scraped_comments"] = [
        createComment({ id: "existing", handle: "user1", comment: "duplicate" }),
      ];

      const newComments = [
        createComment({ id: "1", comment: "spam" }),
        createComment({ id: "existing", comment: "new text" }),
        createComment({ id: "2", handle: "user1", comment: "duplicate" }),
        createComment({ id: "3", comment: "unique" }),
      ];

      const result = await addScrapedComments(newComments);

      expect(result.stored).toBe(1);
      expect(result.duplicates).toBe(2);
      expect(result.ignored).toBe(1);
      const stored = mockStorage["tiktok_buddy_scraped_comments"] as ScrapedComment[];
      expect(stored).toHaveLength(2);
      expect(stored[1].comment).toBe("unique");
    });
  });
});
