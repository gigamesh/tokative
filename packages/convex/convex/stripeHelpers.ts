import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

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
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      subscriptionPlan: args.subscriptionPlan,
      subscriptionStatus: args.subscriptionStatus,
      stripeSubscriptionId: args.stripeSubscriptionId,
      subscriptionPriceId: args.subscriptionPriceId,
      subscriptionInterval: args.subscriptionInterval,
      currentPeriodEnd: args.currentPeriodEnd,
    });
  },
});
