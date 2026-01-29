import { describe, it, beforeEach } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestContext, createTestUser, makeComment, expect } from "./helpers";

describe("comments", () => {
  let t: ReturnType<typeof createTestContext>;
  let clerkId: string;

  beforeEach(async () => {
    t = createTestContext();
    clerkId = `test-${Date.now()}-${Math.random()}`;
    await createTestUser(t, clerkId);
  });

  describe("list", () => {
    it("returns empty array for user with no comments", async () => {
      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toEqual([]);
    });

    it("returns comments for user", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [makeComment({ comment: "Hello world" })],
      });

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(1);
      expect(comments[0].comment).toBe("Hello world");
    });

    it("does not return other users comments", async () => {
      const otherClerkId = `other-${Date.now()}`;
      await createTestUser(t, otherClerkId);

      await t.mutation(api.comments.addBatch, {
        clerkId: otherClerkId,
        comments: [makeComment({ comment: "Other user comment" })],
      });

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toEqual([]);
    });
  });

  describe("addBatch", () => {
    it("stores new comments", async () => {
      const result = await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ externalId: "1", comment: "First" }),
          makeComment({ externalId: "2", comment: "Second" }),
        ],
      });

      expect(result.stored).toBe(2);
      expect(result.duplicates).toBe(0);
      expect(result.ignored).toBe(0);
    });

    it("deduplicates by externalId", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [makeComment({ externalId: "dup-1", comment: "First" })],
      });

      const result = await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [makeComment({ externalId: "dup-1", comment: "Duplicate" })],
      });

      expect(result.stored).toBe(0);
      expect(result.duplicates).toBe(1);

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(1);
      expect(comments[0].comment).toBe("First");
    });

    it("filters comments matching ignore list", async () => {
      const result = await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ externalId: "1", comment: "Hello world" }),
          makeComment({ externalId: "2", comment: "Buy my stuff" }),
          makeComment({ externalId: "3", comment: "Nice video" }),
        ],
        ignoreList: ["buy my"],
      });

      expect(result.stored).toBe(2);
      expect(result.ignored).toBe(1);

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(2);
      expect(comments.map((c) => c.comment)).not.toContain("Buy my stuff");
    });

    it("ignore list is case-insensitive", async () => {
      const result = await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [makeComment({ externalId: "1", comment: "BUY MY STUFF" })],
        ignoreList: ["buy my"],
      });

      expect(result.ignored).toBe(1);
      expect(result.stored).toBe(0);
    });
  });

  describe("update", () => {
    it("updates reply status fields", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [makeComment({ externalId: "update-test" })],
      });

      await t.mutation(api.comments.update, {
        clerkId,
        externalId: "update-test",
        updates: {
          replySent: true,
          repliedAt: Date.now(),
          replyContent: "Thanks!",
        },
      });

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments[0].replySent).toBe(true);
      expect(comments[0].replyContent).toBe("Thanks!");
    });
  });

  describe("remove", () => {
    it("removes a single comment", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ externalId: "keep" }),
          makeComment({ externalId: "remove" }),
        ],
      });

      await t.mutation(api.comments.remove, {
        clerkId,
        externalId: "remove",
      });

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe("keep");
    });
  });

  describe("removeBatch", () => {
    it("removes multiple comments", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ externalId: "keep" }),
          makeComment({ externalId: "remove1" }),
          makeComment({ externalId: "remove2" }),
        ],
      });

      await t.mutation(api.comments.removeBatch, {
        clerkId,
        externalIds: ["remove1", "remove2"],
      });

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe("keep");
    });
  });

});
