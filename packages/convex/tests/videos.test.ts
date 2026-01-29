import { describe, it, beforeEach } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestContext, createTestUser, makeVideo, expect } from "./helpers";

describe("videos", () => {
  let t: ReturnType<typeof createTestContext>;
  let clerkId: string;

  beforeEach(async () => {
    t = createTestContext();
    clerkId = `test-${Date.now()}-${Math.random()}`;
    await createTestUser(t, clerkId);
  });

  describe("list", () => {
    it("returns empty array for user with no videos", async () => {
      const videos = await t.query(api.videos.list, { clerkId });
      expect(videos).toEqual([]);
    });

    it("returns videos sorted by order", async () => {
      await t.mutation(api.videos.addBatch, {
        clerkId,
        videos: [
          makeVideo({ videoId: "v3", order: 3 }),
          makeVideo({ videoId: "v1", order: 1 }),
          makeVideo({ videoId: "v2", order: 2 }),
        ],
      });

      const videos = await t.query(api.videos.list, { clerkId });
      expect(videos).toHaveLength(3);
      expect(videos.map((v) => v.order)).toEqual([1, 2, 3]);
    });
  });

  describe("addBatch", () => {
    it("stores new videos", async () => {
      const result = await t.mutation(api.videos.addBatch, {
        clerkId,
        videos: [
          makeVideo({ videoId: "vid1" }),
          makeVideo({ videoId: "vid2" }),
        ],
      });

      expect(result.stored).toBe(2);
      expect(result.duplicates).toBe(0);
    });

    it("deduplicates by videoId", async () => {
      await t.mutation(api.videos.addBatch, {
        clerkId,
        videos: [makeVideo({ videoId: "dup-vid" })],
      });

      const result = await t.mutation(api.videos.addBatch, {
        clerkId,
        videos: [makeVideo({ videoId: "dup-vid" })],
      });

      expect(result.stored).toBe(0);
      expect(result.duplicates).toBe(1);

      const videos = await t.query(api.videos.list, { clerkId });
      expect(videos).toHaveLength(1);
    });

    it("different users can have same videoId", async () => {
      const otherClerkId = `other-${Date.now()}`;
      await createTestUser(t, otherClerkId);

      await t.mutation(api.videos.addBatch, {
        clerkId,
        videos: [makeVideo({ videoId: "shared-vid" })],
      });

      const result = await t.mutation(api.videos.addBatch, {
        clerkId: otherClerkId,
        videos: [makeVideo({ videoId: "shared-vid" })],
      });

      expect(result.stored).toBe(1);
    });
  });

  describe("markCommentsScraped", () => {
    it("marks video as scraped", async () => {
      await t.mutation(api.videos.addBatch, {
        clerkId,
        videos: [makeVideo({ videoId: "mark-test", commentsScraped: false })],
      });

      await t.mutation(api.videos.markCommentsScraped, {
        clerkId,
        videoId: "mark-test",
        commentsScraped: true,
      });

      const videos = await t.query(api.videos.list, { clerkId });
      expect(videos[0].commentsScraped).toBe(true);
    });
  });

  describe("remove", () => {
    it("removes a single video", async () => {
      await t.mutation(api.videos.addBatch, {
        clerkId,
        videos: [
          makeVideo({ videoId: "keep" }),
          makeVideo({ videoId: "remove" }),
        ],
      });

      await t.mutation(api.videos.remove, {
        clerkId,
        videoId: "remove",
      });

      const videos = await t.query(api.videos.list, { clerkId });
      expect(videos).toHaveLength(1);
      expect(videos[0].videoId).toBe("keep");
    });
  });

  describe("removeBatch", () => {
    it("removes multiple videos", async () => {
      await t.mutation(api.videos.addBatch, {
        clerkId,
        videos: [
          makeVideo({ videoId: "keep" }),
          makeVideo({ videoId: "remove1" }),
          makeVideo({ videoId: "remove2" }),
        ],
      });

      await t.mutation(api.videos.removeBatch, {
        clerkId,
        videoIds: ["remove1", "remove2"],
      });

      const videos = await t.query(api.videos.list, { clerkId });
      expect(videos).toHaveLength(1);
    });
  });
});
