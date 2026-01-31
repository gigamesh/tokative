import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOrCreate as getOrCreateProfile } from "./tiktokProfiles";

export const list = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return [];
    }

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const profileIds = [...new Set(comments.map((c) => c.tiktokProfileId))];
    const profiles = await Promise.all(
      profileIds.map((id) => ctx.db.get(id))
    );
    const profileMap = new Map(
      profiles.filter(Boolean).map((p) => [p!._id, p!])
    );

    return comments.map((c) => {
      const profile = profileMap.get(c.tiktokProfileId);
      return {
        id: c.commentId,
        handle: profile?.handle ?? "",
        comment: c.comment,
        scrapedAt: new Date(c.scrapedAt).toISOString(),
        profileUrl: profile?.profileUrl ?? "",
        avatarUrl: profile?.avatarUrl,
        videoUrl: c.videoUrl,
        replySent: c.replySent,
        repliedAt: c.repliedAt ? new Date(c.repliedAt).toISOString() : undefined,
        replyError: c.replyError,
        replyContent: c.replyContent,
        commentTimestamp: c.commentTimestamp,
        commentId: c.commentId,
        videoId: c.videoId,
        parentCommentId: c.parentCommentId,
        isReply: c.isReply,
        replyCount: c.replyCount,
        _convexId: c._id,
      };
    });
  },
});

const commentInput = {
  commentId: v.string(),
  tiktokUserId: v.string(),
  handle: v.string(),
  comment: v.string(),
  scrapedAt: v.number(),
  profileUrl: v.string(),
  avatarUrl: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
  commentTimestamp: v.optional(v.string()),
  videoId: v.optional(v.string()),
  parentCommentId: v.optional(v.string()),
  isReply: v.optional(v.boolean()),
  replyCount: v.optional(v.number()),
};

export const addBatch = mutation({
  args: {
    clerkId: v.string(),
    comments: v.array(v.object(commentInput)),
    ignoreList: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const ignoreTexts = (args.ignoreList ?? []).map((t) => t.toLowerCase());
    let stored = 0;
    let duplicates = 0;
    let ignored = 0;
    let skipped = 0;

    const profileCache = new Map<string, Awaited<ReturnType<typeof getOrCreateProfile>>>();

    for (const comment of args.comments) {
      // Skip comments missing required tiktokUserId
      if (!comment.tiktokUserId) {
        skipped++;
        continue;
      }

      if (
        ignoreTexts.some((ignoreText) =>
          comment.comment.toLowerCase().includes(ignoreText)
        )
      ) {
        ignored++;
        continue;
      }

      const existing = await ctx.db
        .query("comments")
        .withIndex("by_user_and_comment_id", (q) =>
          q.eq("userId", user._id).eq("commentId", comment.commentId)
        )
        .unique();

      if (existing) {
        duplicates++;
        continue;
      }

      let tiktokProfileId = profileCache.get(comment.tiktokUserId);
      if (!tiktokProfileId) {
        tiktokProfileId = await getOrCreateProfile(ctx, user._id, {
          tiktokUserId: comment.tiktokUserId,
          handle: comment.handle,
          profileUrl: comment.profileUrl,
          avatarUrl: comment.avatarUrl,
        });
        profileCache.set(comment.tiktokUserId, tiktokProfileId);
      }

      await ctx.db.insert("comments", {
        userId: user._id,
        tiktokProfileId,
        commentId: comment.commentId,
        comment: comment.comment,
        scrapedAt: comment.scrapedAt,
        videoUrl: comment.videoUrl,
        commentTimestamp: comment.commentTimestamp,
        videoId: comment.videoId,
        parentCommentId: comment.parentCommentId,
        isReply: comment.isReply,
        replyCount: comment.replyCount,
      });
      stored++;
    }

    return { stored, duplicates, ignored, skipped };
  },
});

export const update = mutation({
  args: {
    clerkId: v.string(),
    commentId: v.string(),
    updates: v.object({
      replySent: v.optional(v.boolean()),
      repliedAt: v.optional(v.number()),
      replyError: v.optional(v.string()),
      replyContent: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const comment = await ctx.db
      .query("comments")
      .withIndex("by_user_and_comment_id", (q) =>
        q.eq("userId", user._id).eq("commentId", args.commentId)
      )
      .unique();

    if (!comment) {
      throw new Error("Comment not found");
    }

    await ctx.db.patch(comment._id, args.updates);
  },
});

export const remove = mutation({
  args: {
    clerkId: v.string(),
    commentId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const comment = await ctx.db
      .query("comments")
      .withIndex("by_user_and_comment_id", (q) =>
        q.eq("userId", user._id).eq("commentId", args.commentId)
      )
      .unique();

    if (comment) {
      await ctx.db.delete(comment._id);
    }
  },
});

export const removeBatch = mutation({
  args: {
    clerkId: v.string(),
    commentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    for (const commentId of args.commentIds) {
      const comment = await ctx.db
        .query("comments")
        .withIndex("by_user_and_comment_id", (q) =>
          q.eq("userId", user._id).eq("commentId", commentId)
        )
        .unique();

      if (comment) {
        await ctx.db.delete(comment._id);
      }
    }
  },
});
