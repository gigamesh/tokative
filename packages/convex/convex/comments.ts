import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  CommentInsertData,
  deleteComment,
  deleteCommentsBatchDirect,
  insertCommentsBatch,
} from "./commentHelpers";
import { detectLanguages } from "./lib/detectLanguage";
import {
  getCurrentMonthStart,
  getEffectivePlan,
  getMonthlyLimit,
  getMonthlyReplyLimit,
  hasTranslation,
} from "./plans";
import { buildSearchResults } from "./searchHelpers";
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

    return comments.map(formatComment);
  },
});

function formatComment(c: Doc<"comments">) {
  return {
    id: c.commentId,
    handle: c.handle ?? "",
    comment: c.comment,
    scrapedAt: new Date(c.scrapedAt).toISOString(),
    profileUrl: c.profileUrl ?? "",
    avatarUrl: c.avatarUrl,
    videoUrl: c.videoUrl,
    repliedTo: c.repliedTo,
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
    detectedLanguage: c.detectedLanguage,
    translatedText: c.translatedText,
    replyOriginalContent: c.replyOriginalContent,
    _convexId: c._id,
  };
}

export const listPaginated = query({
  args: {
    clerkId: v.string(),
    videoId: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    search: v.optional(v.string()),
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

    const order = args.sortOrder ?? "desc";
    const searchLower = args.search?.toLowerCase().trim() || "";

    if (searchLower) {
      const allComments = await (args.videoId
        ? ctx.db
            .query("comments")
            .withIndex("by_user_video_and_timestamp", (q) =>
              q.eq("userId", user._id).eq("videoId", args.videoId),
            )
            .order(order)
            .collect()
        : ctx.db
            .query("comments")
            .withIndex("by_user_and_timestamp", (q) => q.eq("userId", user._id))
            .order(order)
            .collect());

      const { results: matching } = buildSearchResults(
        allComments,
        searchLower,
      );

      matching.sort((a, b) => {
        const aTime = a.commentTimestamp
          ? new Date(a.commentTimestamp).getTime()
          : a.scrapedAt;
        const bTime = b.commentTimestamp
          ? new Date(b.commentTimestamp).getTime()
          : b.scrapedAt;
        return order === "desc" ? bTime - aTime : aTime - bTime;
      });

      const cursor = args.paginationOpts.cursor
        ? parseInt(args.paginationOpts.cursor, 10)
        : 0;
      const pageSize = args.paginationOpts.numItems;
      const pageComments = matching.slice(cursor, cursor + pageSize);
      const nextCursor = cursor + pageSize;
      const isDone = nextCursor >= matching.length;

      return {
        page: pageComments.map(formatComment),
        isDone,
        continueCursor: isDone ? "" : String(nextCursor),
      };
    }

    const topLevelResult = args.videoId
      ? await ctx.db
          .query("comments")
          .withIndex("by_user_video_toplevel_and_timestamp", (q) =>
            q
              .eq("userId", user._id)
              .eq("videoId", args.videoId)
              .eq("isReply", false),
          )
          .order(order)
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("comments")
          .withIndex("by_user_toplevel_and_timestamp", (q) =>
            q.eq("userId", user._id).eq("isReply", false),
          )
          .order(order)
          .paginate(args.paginationOpts);

    const parentCommentIds = topLevelResult.page
      .map((c) => c.commentId)
      .filter(Boolean);

    const replies: typeof topLevelResult.page = [];
    for (const parentId of parentCommentIds) {
      const parentReplies = await ctx.db
        .query("comments")
        .withIndex("by_user_and_parent", (q) =>
          q.eq("userId", user._id).eq("parentCommentId", parentId),
        )
        .collect();
      replies.push(...parentReplies);
    }

    const allComments = [...topLevelResult.page, ...replies];

    return {
      page: allComments.map(formatComment),
      isDone: topLevelResult.isDone,
      continueCursor: topLevelResult.continueCursor,
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
  isReply: v.boolean(),
  replyCount: v.optional(v.number()),
  source: v.optional(v.union(v.literal("app"), v.literal("scraped"))),
};

export const addBatch = mutation({
  args: {
    clerkId: v.string(),
    comments: v.array(v.object(commentInput)),
    ignoreList: v.optional(v.array(v.string())),
    targetLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const plan = getEffectivePlan(user);
    const monthlyLimit = getMonthlyLimit(plan);
    const monthStart = getCurrentMonthStart();

    let monthlyCount = user.monthlyCommentCount ?? 0;
    if (
      !user.monthlyCommentResetAt ||
      user.monthlyCommentResetAt < monthStart
    ) {
      monthlyCount = 0;
      await ctx.db.patch(user._id, {
        monthlyCommentCount: 0,
        monthlyCommentResetAt: monthStart,
      });
    }

    if (monthlyCount >= monthlyLimit) {
      return {
        new: 0,
        preexisting: 0,
        ignored: 0,
        missingTiktokUserId: 0,
        limitReached: true,
        monthlyLimit,
        currentCount: monthlyCount,
        plan,
      };
    }

    const remainingMonthlyBudget = monthlyLimit - monthlyCount;

    const ignoreTexts = (args.ignoreList ?? []).map((t) => t.toLowerCase());
    let preexisting = 0;
    let ignored = 0;
    let missingTiktokUserId = 0;

    const profileCache = new Map<
      string,
      Awaited<ReturnType<typeof getOrCreateProfile>>
    >();
    const avatarsToStore: Array<{
      profileId: Id<"tiktokProfiles">;
      tiktokUserId: string;
      tiktokAvatarUrl: string;
    }> = [];
    const commentsToInsert: Array<{
      tiktokProfileId: Id<"tiktokProfiles">;
      data: CommentInsertData;
    }> = [];

    for (const comment of args.comments) {
      if (!comment.tiktokUserId) {
        missingTiktokUserId++;
        continue;
      }

      if (
        ignoreTexts.some((ignoreText) =>
          comment.comment.toLowerCase().includes(ignoreText),
        )
      ) {
        ignored++;
        continue;
      }

      const existing = await ctx.db
        .query("comments")
        .withIndex("by_user_and_comment_id", (q) =>
          q.eq("userId", user._id).eq("commentId", comment.commentId),
        )
        .unique();

      if (existing) {
        preexisting++;
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

      if (commentsToInsert.length >= remainingMonthlyBudget) {
        break;
      }

      commentsToInsert.push({
        tiktokProfileId: profileResult.profileId,
        data: {
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
          handle: comment.handle,
          profileUrl: comment.profileUrl,
          avatarUrl: comment.avatarUrl,
        },
      });
    }

    // Use helper to insert comments and update profile counts
    const newCount = await insertCommentsBatch(ctx, user._id, commentsToInsert);

    if (commentsToInsert.length > 0) {
      const newDocIds: Id<"comments">[] = [];
      for (const item of commentsToInsert) {
        const doc = await ctx.db
          .query("comments")
          .withIndex("by_user_and_comment_id", (q) =>
            q.eq("userId", user._id).eq("commentId", item.data.commentId),
          )
          .unique();
        if (doc) newDocIds.push(doc._id);
      }
      if (newDocIds.length > 0) {
        await detectLanguages(ctx, newDocIds);

        if (args.targetLanguage && hasTranslation(plan)) {
          const appReplyDocIds = newDocIds.filter(
            (_, i) => commentsToInsert[i]?.data.source === "app",
          );
          if (appReplyDocIds.length > 0) {
            await ctx.scheduler.runAfter(
              0,
              internal.translation.translateAppReplies,
              {
                commentDocIds: appReplyDocIds,
                targetLanguage: args.targetLanguage,
              },
            );
          }
        }
      }
    }

    if (avatarsToStore.length > 0) {
      await ctx.scheduler.runAfter(0, internal.imageStorage.storeAvatarBatch, {
        avatars: avatarsToStore.map((a) => ({
          profileId: a.profileId,
          tiktokUserId: a.tiktokUserId,
          tiktokUrl: a.tiktokAvatarUrl,
        })),
      });
    }

    if (newCount > 0) {
      const updatedMonthlyCount = monthlyCount + newCount;
      await ctx.db.patch(user._id, {
        monthlyCommentCount: updatedMonthlyCount,
        monthlyCommentResetAt: user.monthlyCommentResetAt ?? monthStart,
      });
    }

    const updatedCount = monthlyCount + newCount;
    const limitReached = updatedCount >= monthlyLimit;

    return {
      new: newCount,
      preexisting,
      ignored,
      missingTiktokUserId,
      limitReached,
      monthlyLimit,
      currentCount: updatedCount,
      plan,
    };
  },
});

export const update = mutation({
  args: {
    clerkId: v.string(),
    commentId: v.string(),
    updates: v.object({
      repliedTo: v.optional(v.boolean()),
      repliedAt: v.optional(v.number()),
      replyError: v.optional(v.string()),
      replyContent: v.optional(v.string()),
      replyOriginalContent: v.optional(v.string()),
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
        q.eq("userId", user._id).eq("commentId", args.commentId),
      )
      .unique();

    if (!comment) {
      throw new Error("Comment not found");
    }

    let replyLimitReached = false;

    if (args.updates.repliedTo === true && !comment.repliedTo) {
      const plan = getEffectivePlan(user);
      const replyLimit = getMonthlyReplyLimit(plan);
      const monthStart = getCurrentMonthStart();

      let monthlyReplyCount = user.monthlyReplyCount ?? 0;
      if (!user.monthlyReplyResetAt || user.monthlyReplyResetAt < monthStart) {
        monthlyReplyCount = 0;
      }

      monthlyReplyCount += 1;
      replyLimitReached = monthlyReplyCount >= replyLimit;

      await ctx.db.patch(user._id, {
        replyCount: (user.replyCount ?? 0) + 1,
        monthlyReplyCount,
        monthlyReplyResetAt:
          user.monthlyReplyResetAt && user.monthlyReplyResetAt >= monthStart
            ? user.monthlyReplyResetAt
            : monthStart,
      });
    }

    await ctx.db.patch(comment._id, args.updates);

    return { replyLimitReached };
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
        q.eq("userId", user._id).eq("commentId", args.commentId),
      )
      .unique();

    if (comment) {
      // Use helper to delete comment and update profile count
      await deleteComment(ctx, comment._id);
    }
  },
});

const REMOVE_BATCH_CHUNK_SIZE = 400;

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

    const chunk = args.commentIds.slice(0, REMOVE_BATCH_CHUNK_SIZE);
    const overflow = args.commentIds.slice(REMOVE_BATCH_CHUNK_SIZE);

    const commentDocs: Doc<"comments">[] = [];
    for (const commentId of chunk) {
      const comment = await ctx.db
        .query("comments")
        .withIndex("by_user_and_comment_id", (q) =>
          q.eq("userId", user._id).eq("commentId", commentId),
        )
        .unique();

      if (comment) {
        commentDocs.push(comment);
      }
    }

    await deleteCommentsBatchDirect(ctx, commentDocs);

    if (overflow.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.comments.removeBatchContinuation,
        { userId: user._id, commentIds: overflow },
      );
    }
  },
});

export const removeBatchContinuation = internalMutation({
  args: {
    userId: v.id("users"),
    commentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const chunk = args.commentIds.slice(0, REMOVE_BATCH_CHUNK_SIZE);
    const overflow = args.commentIds.slice(REMOVE_BATCH_CHUNK_SIZE);

    const commentDocs: Doc<"comments">[] = [];
    for (const commentId of chunk) {
      const comment = await ctx.db
        .query("comments")
        .withIndex("by_user_and_comment_id", (q) =>
          q.eq("userId", args.userId).eq("commentId", commentId),
        )
        .unique();

      if (comment) {
        commentDocs.push(comment);
      }
    }

    await deleteCommentsBatchDirect(ctx, commentDocs);

    if (overflow.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.comments.removeBatchContinuation,
        { userId: args.userId, commentIds: overflow },
      );
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
      return { counts: {}, totalCount: 0 };
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

    return { counts, totalCount: comments.length };
  },
});

export const findMatchingByText = query({
  args: {
    clerkId: v.string(),
    commentText: v.string(),
    excludeCommentId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) return [];

    const normalizedText = args.commentText.trim();
    const allUserComments = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return allUserComments
      .filter(
        (c) =>
          c.commentId !== args.excludeCommentId &&
          c.comment.trim() === normalizedText,
      )
      .map((c) => c.commentId);
  },
});

/** Migration: rename the old `replySent` field → `repliedTo` on existing documents. */
export const migrateReplySentToRepliedTo = mutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const BATCH_SIZE = args.batchSize ?? 100;

    const result = await ctx.db.query("comments").paginate({
      numItems: BATCH_SIZE,
      cursor: args.cursor ?? null,
    });

    let migrated = 0;
    for (const doc of result.page) {
      const raw = doc as Record<string, unknown>;
      if (raw.replySent !== undefined) {
        await ctx.db.patch(doc._id, {
          repliedTo: raw.replySent as boolean,
        } as never);
        await ctx.db.patch(doc._id, {
          replySent: undefined,
        } as never);
        migrated++;
      }
    }

    return {
      migrated,
      processed: result.page.length,
      isDone: result.isDone,
      continueCursor: result.isDone ? null : result.continueCursor,
    };
  },
});
