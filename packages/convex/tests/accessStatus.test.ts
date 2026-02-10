import { describe, it, beforeEach } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestContext, expect } from "./helpers";

describe("getAccessStatus", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  it("returns null for non-existent user", async () => {
    const result = await t.query(api.users.getAccessStatus, {
      clerkId: "nonexistent",
    });
    expect(result).toBeNull();
  });

  it("returns free plan defaults for a new user", async () => {
    const clerkId = `user-${Date.now()}`;
    await t.mutation(api.users.getOrCreate, { clerkId });

    const result = await t.query(api.users.getAccessStatus, { clerkId });

    expect(result).not.toBeNull();
    expect(result!.subscription.plan).toBe("free");
    expect(result!.subscription.monthlyLimit).toBe(200);
    expect(result!.subscription.monthlyUsed).toBe(0);
    expect(result!.features.translation).toBe(false);
    expect(result!.isAllowed).toBe(true);
  });

  it("returns pro plan info for pro subscriber", async () => {
    const clerkId = `user-${Date.now()}`;
    await t.mutation(api.users.getOrCreate, { clerkId });

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionInterval: "month",
        currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
    });

    const result = await t.query(api.users.getAccessStatus, { clerkId });

    expect(result!.subscription.plan).toBe("pro");
    expect(result!.subscription.status).toBe("active");
    expect(result!.subscription.interval).toBe("month");
    expect(result!.subscription.monthlyLimit).toBe(2_000);
    expect(result!.features.translation).toBe(true);
  });

  it("returns premium plan info for premium subscriber", async () => {
    const clerkId = `user-${Date.now()}`;
    await t.mutation(api.users.getOrCreate, { clerkId });

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        subscriptionPlan: "premium",
        subscriptionStatus: "active",
        subscriptionInterval: "year",
      });
    });

    const result = await t.query(api.users.getAccessStatus, { clerkId });

    expect(result!.subscription.plan).toBe("premium");
    expect(result!.subscription.monthlyLimit).toBe(10_000);
    expect(result!.subscription.interval).toBe("year");
    expect(result!.features.translation).toBe(true);
  });

  it("treats whitelisted emails as premium", async () => {
    const clerkId = `user-${Date.now()}`;
    await t.mutation(api.users.getOrCreate, {
      clerkId,
      email: "m.masurka@gmail.com",
    });

    const result = await t.query(api.users.getAccessStatus, { clerkId });

    expect(result!.subscription.plan).toBe("premium");
    expect(result!.subscription.monthlyLimit).toBe(10_000);
    expect(result!.features.translation).toBe(true);
  });

  it("reports correct monthly usage from current month", async () => {
    const clerkId = `user-${Date.now()}`;
    await t.mutation(api.users.getOrCreate, { clerkId });

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        monthlyCommentCount: 42,
        monthlyCommentResetAt: Date.now(),
      });
    });

    const result = await t.query(api.users.getAccessStatus, { clerkId });

    expect(result!.subscription.monthlyUsed).toBe(42);
  });

  it("resets monthly usage to 0 when reset timestamp is from last month", async () => {
    const clerkId = `user-${Date.now()}`;
    await t.mutation(api.users.getOrCreate, { clerkId });

    const lastMonth = new Date();
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        monthlyCommentCount: 150,
        monthlyCommentResetAt: lastMonth.getTime(),
      });
    });

    const result = await t.query(api.users.getAccessStatus, { clerkId });

    expect(result!.subscription.monthlyUsed).toBe(0);
  });

  it("shows past_due status", async () => {
    const clerkId = `user-${Date.now()}`;
    await t.mutation(api.users.getOrCreate, { clerkId });

    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .unique();
      if (!user) throw new Error("User not found");
      await ctx.db.patch(user._id, {
        subscriptionPlan: "pro",
        subscriptionStatus: "past_due",
      });
    });

    const result = await t.query(api.users.getAccessStatus, { clerkId });

    expect(result!.subscription.status).toBe("past_due");
    expect(result!.subscription.plan).toBe("pro");
  });
});
