import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.userId);
  },
});

export const getReferralByReferred = internalQuery({
  args: { referredId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", args.referredId))
      .first();
  },
});

export const updateReferralStatus = internalMutation({
  args: {
    referralId: v.id("referrals"),
    status: v.union(v.literal("pending"), v.literal("qualified")),
    stripeCouponId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.referralId, {
      status: args.status,
      ...(args.status === "qualified" && { qualifiedAt: Date.now() }),
      ...(args.stripeCouponId && { stripeCouponId: args.stripeCouponId }),
    });
  },
});
