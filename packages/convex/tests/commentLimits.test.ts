import { describe, it, beforeEach } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestContext, createTestUser, makeComment, expect } from "./helpers";

describe("addBatch limit enforcement", () => {
  let t: ReturnType<typeof createTestContext>;
  let clerkId: string;

  beforeEach(async () => {
    t = createTestContext();
    clerkId = `test-${Date.now()}-${Math.random()}`;
    await createTestUser(t, clerkId);
  });

  it("returns plan and limit fields in response", async () => {
    const result = await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [makeComment()],
    });

    expect(result.plan).toBe("free");
    expect(result.monthlyLimit).toBe(200);
    expect(result.currentCount).toBeGreaterThanOrEqual(1);
    expect(result.limitReached).toBe(false);
  });

  it("tracks monthly count across batches", async () => {
    const r1 = await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [makeComment({ commentId: "c1" }), makeComment({ commentId: "c2" })],
    });
    expect(r1.currentCount).toBe(2);

    const r2 = await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [makeComment({ commentId: "c3" })],
    });
    expect(r2.currentCount).toBe(3);
  });

  it("does not count preexisting comments toward monthly total", async () => {
    await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [makeComment({ commentId: "dup-1" })],
    });

    const r2 = await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [makeComment({ commentId: "dup-1" }), makeComment({ commentId: "new-1" })],
    });

    expect(r2.preexisting).toBe(1);
    expect(r2.new).toBe(1);
    expect(r2.currentCount).toBe(2);
  });

  it("returns limitReached when user is at their monthly limit", async () => {
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        monthlyCommentCount: 200,
        monthlyCommentResetAt: Date.now(),
      });
    });

    const result = await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [makeComment()],
    });

    expect(result.limitReached).toBe(true);
    expect(result.new).toBe(0);
    expect(result.currentCount).toBe(200);
    expect(result.plan).toBe("free");
  });

  it("caps a batch to the remaining monthly budget", async () => {
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        monthlyCommentCount: 198,
        monthlyCommentResetAt: Date.now(),
      });
    });

    const result = await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [
        makeComment({ commentId: "a1" }),
        makeComment({ commentId: "a2" }),
        makeComment({ commentId: "a3" }),
        makeComment({ commentId: "a4" }),
        makeComment({ commentId: "a5" }),
      ],
    });

    expect(result.new).toBe(2);
    expect(result.currentCount).toBe(200);
    expect(result.limitReached).toBe(true);
  });

  it("resets monthly count when a new month starts (lazy reset)", async () => {
    const lastMonth = new Date();
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        monthlyCommentCount: 200,
        monthlyCommentResetAt: lastMonth.getTime(),
      });
    });

    const result = await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [makeComment()],
    });

    expect(result.limitReached).toBe(false);
    expect(result.new).toBe(1);
    expect(result.currentCount).toBe(1);
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
        monthlyCommentCount: 199,
        monthlyCommentResetAt: Date.now(),
      });
    });

    const result = await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [makeComment()],
    });

    expect(result.limitReached).toBe(false);
    expect(result.plan).toBe("pro");
    expect(result.monthlyLimit).toBe(2_000);
  });

  it("blocks at 200 for free but not for pro", async () => {
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        monthlyCommentCount: 200,
        monthlyCommentResetAt: Date.now(),
      });
    });

    const result = await t.mutation(api.comments.addBatch, {
      clerkId,
      comments: [makeComment()],
    });

    expect(result.limitReached).toBe(false);
    expect(result.new).toBe(1);
  });
});
