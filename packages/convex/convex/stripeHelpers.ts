import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { PlanName } from "./plans";

const PLAN_RANK: Record<PlanName, number> = { free: 0, pro: 1, premium: 2 };

export const getUserByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

export const getUserByStripeCustomerId = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .unique();
  },
});

export const setStripeCustomerId = internalMutation({
  args: { userId: v.id("users"), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeCustomerId: args.stripeCustomerId,
    });
  },
});

export const updateSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    subscriptionPlan: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("premium")
    ),
    subscriptionStatus: v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("incomplete")
    ),
    stripeSubscriptionId: v.string(),
    subscriptionPriceId: v.string(),
    subscriptionInterval: v.union(v.literal("month"), v.literal("year")),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    const oldPlan = user?.subscriptionPlan ?? "free";
    const isUpgrade =
      args.subscriptionPlan !== oldPlan &&
      PLAN_RANK[args.subscriptionPlan] > PLAN_RANK[oldPlan];

    await ctx.db.patch(args.userId, {
      subscriptionPlan: args.subscriptionPlan,
      subscriptionStatus: args.subscriptionStatus,
      stripeSubscriptionId: args.stripeSubscriptionId,
      subscriptionPriceId: args.subscriptionPriceId,
      subscriptionInterval: args.subscriptionInterval,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      ...(isUpgrade && {
        monthlyCommentCount: 0,
        monthlyCommentResetAt: Date.now(),
        monthlyReplyCount: 0,
        monthlyReplyResetAt: Date.now(),
      }),
    });
  },
});
