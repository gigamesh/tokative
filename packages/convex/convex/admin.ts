import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { isAdminEmail } from "./constants";
import { AFFILIATE_COMMISSION_RATE_BPS } from "./affiliateConstants";

export const getStats = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!caller?.email || !isAdminEmail(caller.email)) {
      throw new Error("Unauthorized");
    }

    const users = await ctx.db.query("users").collect();

    let totalComments = 0;
    let totalReplies = 0;
    let totalVideos = 0;

    const userStats = users.map((u) => {
      const comments = u.commentCount ?? 0;
      const replies = u.replyCount ?? 0;
      const videos = u.videoCount ?? 0;
      totalComments += comments;
      totalReplies += replies;
      totalVideos += videos;
      return {
        email: u.email ?? "unknown",
        commentCount: comments,
        replyCount: replies,
        videoCount: videos,
        createdAt: u.createdAt,
      };
    });

    return {
      users: userStats,
      totals: {
        totalComments,
        totalReplies,
        totalVideos,
        uniqueUsers: users.length,
      },
    };
  },
});

/** One-time migration to backfill commentCount, replyCount, videoCount on all user docs. */
export const backfillUserCounts = mutation({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updated = 0;

    for (const user of users) {
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      const commentCount = comments.length;
      const replyCount = comments.filter((c) => c.repliedTo === true).length;

      const videos = await ctx.db
        .query("videos")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      await ctx.db.patch(user._id, {
        commentCount,
        replyCount,
        videoCount: videos.length,
      });
      updated++;
    }

    return { updated };
  },
});

function assertAdmin(email: string | undefined) {
  if (!email || !isAdminEmail(email)) throw new Error("Unauthorized");
}

export const getAffiliates = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    assertAdmin(caller?.email);

    const affiliates = await ctx.db.query("affiliates").collect();
    const results = [];

    for (const aff of affiliates) {
      const user = await ctx.db.get(aff.userId);
      const commissions = await ctx.db
        .query("affiliateCommissions")
        .withIndex("by_affiliate", (q) => q.eq("affiliateId", aff._id))
        .collect();

      const totalEarned = commissions
        .filter((c) => c.status !== "reversed")
        .reduce((sum, c) => sum + c.commissionCents, 0);

      results.push({
        _id: aff._id,
        email: user?.email ?? "unknown",
        affiliateCode: aff.affiliateCode,
        connectStatus: aff.connectStatus,
        isWhitelisted: aff.isWhitelisted,
        totalEarnedCents: totalEarned,
        createdAt: aff.createdAt,
      });
    }

    return results;
  },
});

export const createAffiliate = mutation({
  args: { clerkId: v.string(), affiliateEmail: v.string() },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    assertAdmin(caller?.email);

    const users = await ctx.db.query("users").collect();
    const targetUser = users.find(
      (u) => u.email?.toLowerCase() === args.affiliateEmail.toLowerCase()
    );
    if (!targetUser) throw new Error("User not found with that email");

    const existing = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", targetUser._id))
      .unique();
    if (existing) throw new Error("User is already an affiliate");

    await ctx.scheduler.runAfter(
      0,
      internal.affiliateHelpers.createAffiliate,
      {
        userId: targetUser._id,
        commissionRate: AFFILIATE_COMMISSION_RATE_BPS,
      }
    );

    return { success: true };
  },
});

export const toggleAffiliateWhitelist = mutation({
  args: {
    clerkId: v.string(),
    affiliateId: v.id("affiliates"),
    isWhitelisted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    assertAdmin(caller?.email);

    await ctx.db.patch(args.affiliateId, {
      isWhitelisted: args.isWhitelisted,
    });
  },
});
