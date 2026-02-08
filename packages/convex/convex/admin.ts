import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { isAdminEmail } from "./constants";

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
