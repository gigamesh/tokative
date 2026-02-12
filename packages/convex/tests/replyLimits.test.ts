import { describe, it, beforeEach } from "vitest";
import { api } from "../convex/_generated/api";
import { BILLING_ENABLED } from "../convex/plans";
import { createTestContext, createTestUser, makeComment, expect } from "./helpers";

describe("comments.update reply limit tracking", () => {
  let t: ReturnType<typeof createTestContext>;
  let clerkId: string;

  beforeEach(async () => {
    t = createTestContext();
    clerkId = `test-${Date.now()}-${Math.random()}`;
    await createTestUser(t, clerkId);
  });

  async function addComment(commentId: string) {
    await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [makeComment({ commentId })],
    });
  }

  async function markReplied(commentId: string) {
    return await t.mutation(api.comments.update, {
      clerkId,
      commentId,
      updates: {
        repliedTo: true,
        repliedAt: Date.now(),
        replyContent: "Test reply",
      },
    });
  }

  it("increments monthlyReplyCount when repliedTo transitions to true", async () => {
    await addComment("c1");
    await markReplied("c1");

    const status = await t.query(api.users.getAccessStatus, { clerkId });
    expect(status!.subscription.repliesUsed).toBe(1);
  });

  it("tracks reply count across multiple updates", async () => {
    await addComment("c1");
    await addComment("c2");
    await addComment("c3");

    await markReplied("c1");
    await markReplied("c2");
    await markReplied("c3");

    const status = await t.query(api.users.getAccessStatus, { clerkId });
    expect(status!.subscription.repliesUsed).toBe(3);
  });

  it("does not increment count when repliedTo is already true", async () => {
    await addComment("c1");
    await markReplied("c1");
    await markReplied("c1");

    const status = await t.query(api.users.getAccessStatus, { clerkId });
    expect(status!.subscription.repliesUsed).toBe(1);
  });

  it.skipIf(!BILLING_ENABLED)("returns replyLimitReached when at limit", async () => {
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        monthlyReplyCount: 49,
        monthlyReplyResetAt: Date.now(),
      });
    });

    await addComment("c1");
    const result = await markReplied("c1");

    expect(result.replyLimitReached).toBe(true);
  });

  it("returns replyLimitReached false when under limit", async () => {
    await addComment("c1");
    const result = await markReplied("c1");

    expect(result.replyLimitReached).toBe(false);
  });

  it("lazy-resets monthly reply count when a new month starts", async () => {
    const lastMonth = new Date();
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        monthlyReplyCount: 50,
        monthlyReplyResetAt: lastMonth.getTime(),
      });
    });

    await addComment("c1");
    const result = await markReplied("c1");

    expect(result.replyLimitReached).toBe(false);

    const status = await t.query(api.users.getAccessStatus, { clerkId });
    expect(status!.subscription.repliesUsed).toBe(1);
  });

  it("uses pro plan limits for pro subscribers", async () => {
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        monthlyReplyCount: 49,
        monthlyReplyResetAt: Date.now(),
      });
    });

    await addComment("c1");
    const result = await markReplied("c1");

    expect(result.replyLimitReached).toBe(false);

    const status = await t.query(api.users.getAccessStatus, { clerkId });
    expect(status!.subscription.replyLimit).toBe(BILLING_ENABLED ? 500 : Number.MAX_SAFE_INTEGER);
    expect(status!.subscription.repliesUsed).toBe(50);
  });
});
