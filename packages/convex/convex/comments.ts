import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
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

    const profileIds = Array.from(new Set(comments.map((c) => c.tiktokProfileId)));
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
        source: c.source,
        _convexId: c._id,
      };
    });
  },
});

export const listPaginated = query({
  args: {
    clerkId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const result = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);

    const profileIds = Array.from(new Set(result.page.map((c) => c.tiktokProfileId)));
    const profiles = await Promise.all(profileIds.map((id) => ctx.db.get(id)));
    const profileMap = new Map(
      profiles.filter(Boolean).map((p) => [p!._id, p!])
    );

    const formattedComments = result.page.map((c) => {
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
        source: c.source,
        _convexId: c._id,
      };
    });

    return {
      page: formattedComments,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
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
  source: v.optional(v.union(v.literal("app"), v.literal("scraped"))),
};

export const addBatch = mutation({
  args: {
    clerkId: v.string(),
    comments: v.array(v.object(commentInput)),
    ignoreList: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // TEMP DIAGNOSTIC
    const videoIds = [...new Set(args.comments.map(c => c.videoId).filter(Boolean))];
    console.log(`[DIAG] addBatch called with ${args.comments.length} comments`);
    console.log(`[DIAG] addBatch: Unique videoIds in batch:`, videoIds);

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
    let missingTiktokUserId = 0;

    const profileCache = new Map<string, Awaited<ReturnType<typeof getOrCreateProfile>>>();
    const avatarsToStore: Array<{ profileId: Id<"tiktokProfiles">; tiktokUserId: string; tiktokAvatarUrl: string }> = [];

    for (const comment of args.comments) {
      if (!comment.tiktokUserId) {
        missingTiktokUserId++;
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

      let profileResult = profileCache.get(comment.tiktokUserId);
      if (!profileResult) {
        profileResult = await getOrCreateProfile(ctx, user._id, {
          tiktokUserId: comment.tiktokUserId,
          handle: comment.handle,
          profileUrl: comment.profileUrl,
          avatarUrl: comment.avatarUrl,
        });
        profileCache.set(comment.tiktokUserId, profileResult);

        if (profileResult.shouldStoreAvatar && profileResult.tiktokAvatarUrl) {
          avatarsToStore.push({
            profileId: profileResult.profileId,
            tiktokUserId: profileResult.tiktokUserId,
            tiktokAvatarUrl: profileResult.tiktokAvatarUrl,
          });
        }
      }

      await ctx.db.insert("comments", {
        userId: user._id,
        tiktokProfileId: profileResult.profileId,
        commentId: comment.commentId,
        comment: comment.comment,
        scrapedAt: comment.scrapedAt,
        videoUrl: comment.videoUrl,
        commentTimestamp: comment.commentTimestamp,
        videoId: comment.videoId,
        parentCommentId: comment.parentCommentId,
        isReply: comment.isReply,
        replyCount: comment.replyCount,
        source: comment.source,
      });
      stored++;
    }

    for (const avatar of avatarsToStore) {
      await ctx.scheduler.runAfter(0, internal.imageStorage.storeAvatar, {
        profileId: avatar.profileId,
        tiktokUserId: avatar.tiktokUserId,
        tiktokUrl: avatar.tiktokAvatarUrl,
      });
    }

    // TEMP DIAGNOSTIC
    console.log(`[DIAG] addBatch result: stored=${stored}, duplicates=${duplicates}, ignored=${ignored}, missingTiktokUserId=${missingTiktokUserId}`);

    return { stored, duplicates, ignored, missingTiktokUserId };
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

export const getCountsByVideo = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return {};
    }

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const counts: Record<string, number> = {};
    for (const comment of comments) {
      if (comment.videoId) {
        counts[comment.videoId] = (counts[comment.videoId] || 0) + 1;
      }
    }

    // TEMP DIAGNOSTIC
    console.log(`[DIAG] getCountsByVideo: Total comments for user: ${comments.length}`);
    console.log(`[DIAG] getCountsByVideo: Video counts:`, JSON.stringify(counts));

    return counts;
  },
});
