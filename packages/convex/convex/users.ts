import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isPremiumWhitelisted } from "./constants";
import {
  BILLING_ENABLED,
  getMonthlyLimit,
  getMonthlyReplyLimit,
  hasTranslation,
  getCurrentMonthStart,
  getEffectivePlan,
} from "./plans";

export const getOrCreate = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      if (args.email && !existing.email) {
        await ctx.db.patch(existing._id, { email: args.email });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      createdAt: Date.now(),
    });
  },
});

export const getAccessStatus = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return null;
    }

    const email = user.email ?? "";
    const whitelisted = isPremiumWhitelisted(email);
    const effectivePlan = getEffectivePlan(user);

    const monthlyLimit = getMonthlyLimit(effectivePlan);
    const replyLimit = getMonthlyReplyLimit(effectivePlan);
    const monthStart = getCurrentMonthStart();
    const monthlyUsed =
      user.monthlyCommentResetAt && user.monthlyCommentResetAt >= monthStart
        ? (user.monthlyCommentCount ?? 0)
        : 0;
    const repliesUsed =
      user.monthlyReplyResetAt && user.monthlyReplyResetAt >= monthStart
        ? (user.monthlyReplyCount ?? 0)
        : 0;

    return {
      isAllowed: true,
      hasCompletedOnboarding: user.hasCompletedOnboarding ?? false,
      email,
      billingEnabled: BILLING_ENABLED,
      features: { translation: hasTranslation(effectivePlan) },
      subscription: {
        plan: effectivePlan,
        status: user.subscriptionStatus ?? (whitelisted ? "active" : null),
        interval: user.subscriptionInterval ?? null,
        currentPeriodEnd: user.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? false,
        monthlyLimit,
        monthlyUsed,
        replyLimit,
        repliesUsed,
      },
    };
  },
});

export const markOnboardingComplete = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, { hasCompletedOnboarding: true });
  },
});
