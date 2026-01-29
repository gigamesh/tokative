import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

    return comments.map((c) => ({
      id: c.externalId,
      handle: c.handle,
      comment: c.comment,
      scrapedAt: new Date(c.scrapedAt).toISOString(),
      profileUrl: c.profileUrl,
      avatarUrl: c.avatarUrl,
      videoUrl: c.videoUrl,
      replySent: c.replySent,
      repliedAt: c.repliedAt ? new Date(c.repliedAt).toISOString() : undefined,
      replyError: c.replyError,
      replyContent: c.replyContent,
      commentTimestamp: c.commentTimestamp,
      commentId: c.commentId,
      videoId: c.videoId,
      parentCommentId: c.parentCommentId,
      replyToReplyId: c.replyToReplyId,
      isReply: c.isReply,
      replyCount: c.replyCount,
      _convexId: c._id,
    }));
  },
});

export const listByVideo = query({
  args: { clerkId: v.string(), videoId: v.string() },
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
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", user._id).eq("videoId", args.videoId)
      )
      .collect();

    return comments.map((c) => ({
      id: c.externalId,
      handle: c.handle,
      comment: c.comment,
      scrapedAt: new Date(c.scrapedAt).toISOString(),
      profileUrl: c.profileUrl,
      avatarUrl: c.avatarUrl,
      videoUrl: c.videoUrl,
      replySent: c.replySent,
      repliedAt: c.repliedAt ? new Date(c.repliedAt).toISOString() : undefined,
      replyError: c.replyError,
      replyContent: c.replyContent,
      commentTimestamp: c.commentTimestamp,
      commentId: c.commentId,
      videoId: c.videoId,
      parentCommentId: c.parentCommentId,
      replyToReplyId: c.replyToReplyId,
      isReply: c.isReply,
      replyCount: c.replyCount,
      _convexId: c._id,
    }));
  },
});

const commentInput = {
  externalId: v.string(),
  handle: v.string(),
  comment: v.string(),
  scrapedAt: v.number(),
  profileUrl: v.string(),
  avatarUrl: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
  commentTimestamp: v.optional(v.string()),
  commentId: v.optional(v.string()),
  videoId: v.optional(v.string()),
  parentCommentId: v.optional(v.string()),
  replyToReplyId: v.optional(v.string()),
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

    for (const comment of args.comments) {
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
        .withIndex("by_user_and_external_id", (q) =>
          q.eq("userId", user._id).eq("externalId", comment.externalId)
        )
        .unique();

      if (existing) {
        duplicates++;
        continue;
      }

      await ctx.db.insert("comments", {
        userId: user._id,
        ...comment,
      });
      stored++;
    }

    return { stored, duplicates, ignored };
  },
});

export const update = mutation({
  args: {
    clerkId: v.string(),
    externalId: v.string(),
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
      .withIndex("by_user_and_external_id", (q) =>
        q.eq("userId", user._id).eq("externalId", args.externalId)
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
    externalId: v.string(),
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
      .withIndex("by_user_and_external_id", (q) =>
        q.eq("userId", user._id).eq("externalId", args.externalId)
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
    externalIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    for (const externalId of args.externalIds) {
      const comment = await ctx.db
        .query("comments")
        .withIndex("by_user_and_external_id", (q) =>
          q.eq("userId", user._id).eq("externalId", externalId)
        )
        .unique();

      if (comment) {
        await ctx.db.delete(comment._id);
      }
    }
  },
});
