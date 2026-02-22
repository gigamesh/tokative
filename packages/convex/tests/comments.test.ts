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

  describe("listPaginated", () => {
    it("returns empty page for user with no comments", async () => {
      const result = await t.query(api.comments.listPaginated, {
        clerkId,
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toEqual([]);
      expect(result.isDone).toBe(true);
    });

    it("returns paginated comments", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ commentId: "1", comment: "First" }),
          makeComment({ commentId: "2", comment: "Second" }),
          makeComment({ commentId: "3", comment: "Third" }),
        ],
      });

      const result = await t.query(api.comments.listPaginated, {
        clerkId,
        paginationOpts: { numItems: 2, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      expect(result.isDone).toBe(false);
    });

    it("continues from cursor", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ commentId: "1", comment: "First" }),
          makeComment({ commentId: "2", comment: "Second" }),
          makeComment({ commentId: "3", comment: "Third" }),
        ],
      });

      const firstPage = await t.query(api.comments.listPaginated, {
        clerkId,
        paginationOpts: { numItems: 2, cursor: null },
      });

      const secondPage = await t.query(api.comments.listPaginated, {
        clerkId,
        paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
      });

      expect(secondPage.page).toHaveLength(1);
      expect(secondPage.isDone).toBe(true);
    });
  });

  describe("addBatch", () => {
    it("stores new comments", async () => {
      const result = await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ commentId: "1", comment: "First" }),
          makeComment({ commentId: "2", comment: "Second" }),
        ],
      });

      expect(result.new).toBe(2);
      expect(result.preexisting).toBe(0);
    });

    it("deduplicates by commentId", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [makeComment({ commentId: "dup-1", comment: "First" })],
      });

      const result = await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [makeComment({ commentId: "dup-1", comment: "Duplicate" })],
      });

      expect(result.new).toBe(0);
      expect(result.preexisting).toBe(1);

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(1);
      expect(comments[0].comment).toBe("First");
    });

    it("stores all comments even if they match ignore list", async () => {
      const result = await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ commentId: "1", comment: "Hello world" }),
          makeComment({ commentId: "2", comment: "Buy my stuff" }),
          makeComment({ commentId: "3", comment: "Nice video" }),
        ],
        ignoreList: ["buy my"],
      });

      expect(result.new).toBe(3);
    });

    it("filters ignored comments at query time via list", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ commentId: "1", comment: "Hello world" }),
          makeComment({ commentId: "2", comment: "Buy my stuff" }),
          makeComment({ commentId: "3", comment: "Nice video" }),
        ],
      });

      // Add ignore list entry
      await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
          .unique();
        await ctx.db.insert("ignoreList", {
          userId: user!._id,
          text: "buy my",
          addedAt: Date.now(),
        });
      });

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(2);
      expect(comments.map((c) => c.comment)).not.toContain("Buy my stuff");
    });

    it("ignore list filtering is case-insensitive", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [makeComment({ commentId: "1", comment: "BUY MY STUFF" })],
      });

      await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
          .unique();
        await ctx.db.insert("ignoreList", {
          userId: user!._id,
          text: "buy my",
          addedAt: Date.now(),
        });
      });

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(0);
    });

    it("un-ignoring restores comments in query results", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ commentId: "1", comment: "Hello world" }),
          makeComment({ commentId: "2", comment: "Buy my stuff" }),
        ],
      });

      // Add ignore list entry
      let ignoreEntryId: any;
      await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
          .unique();
        ignoreEntryId = await ctx.db.insert("ignoreList", {
          userId: user!._id,
          text: "buy my",
          addedAt: Date.now(),
        });
      });

      // Should be filtered
      let comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(1);

      // Remove ignore entry
      await t.run(async (ctx) => {
        await ctx.db.delete(ignoreEntryId);
      });

      // Should now appear again
      comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(2);
      expect(comments.map((c) => c.comment)).toContain("Buy my stuff");
    });
  });

  describe("update", () => {
    it("updates reply status fields", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [makeComment({ commentId: "update-test" })],
      });

      await t.mutation(api.comments.update, {
        clerkId,
        commentId: "update-test",
        updates: {
          repliedTo: true,
          repliedAt: Date.now(),
          replyContent: "Thanks!",
        },
      });

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments[0].repliedTo).toBe(true);
      expect(comments[0].replyContent).toBe("Thanks!");
    });
  });

  describe("remove", () => {
    it("removes a single comment", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ commentId: "keep" }),
          makeComment({ commentId: "remove" }),
        ],
      });

      await t.mutation(api.comments.remove, {
        clerkId,
        commentId: "remove",
      });

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(1);
      expect(comments[0].commentId).toBe("keep");
    });
  });

  describe("removeBatch", () => {
    it("removes multiple comments", async () => {
      await t.mutation(api.comments.addBatch, {
        clerkId,
        comments: [
          makeComment({ commentId: "keep" }),
          makeComment({ commentId: "remove1" }),
          makeComment({ commentId: "remove2" }),
        ],
      });

      await t.mutation(api.comments.removeBatch, {
        clerkId,
        commentIds: ["remove1", "remove2"],
      });

      const comments = await t.query(api.comments.list, { clerkId });
      expect(comments).toHaveLength(1);
      expect(comments[0].commentId).toBe("keep");
    });
  });

});
