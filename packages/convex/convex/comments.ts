import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { detectLanguages } from "./lib/detectLanguage";
import { getOrCreate as getOrCreateProfile } from "./tiktokProfiles";
import {
  insertCommentsBatch,
  deleteComment,
  deleteCommentsBatch,
  CommentInsertData,
} from "./commentHelpers";
import { buildSearchResults } from "./searchHelpers";
import { getMonthlyLimit, getMonthlyReplyLimit, getCurrentMonthStart, type PlanName } from "./plans";

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
    });
  },
});

function formatComment(
  c: {
    commentId: string;
    comment: string;
    scrapedAt: number;
    videoUrl?: string;
    repliedTo?: boolean;
    repliedAt?: number;
    replyError?: string;
    replyContent?: string;
    commentTimestamp?: string;
    videoId?: string;
    parentCommentId?: string;
    isReply?: boolean;
    replyCount?: number;
    source?: "app" | "scraped";
    detectedLanguage?: string;
    translatedText?: string;
    replyOriginalContent?: string;
    _id: Id<"comments">;
    tiktokProfileId: Id<"tiktokProfiles">;
  },
  profile: { handle: string; profileUrl: string; avatarUrl?: string } | undefined,
) {
  return {
    id: c.commentId,
    handle: profile?.handle ?? "",
    comment: c.comment,
    scrapedAt: new Date(c.scrapedAt).toISOString(),
    profileUrl: profile?.profileUrl ?? "",
    avatarUrl: profile?.avatarUrl,
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
              q.eq("userId", user._id).eq("videoId", args.videoId)
            )
            .order(order)
            .collect()
        : ctx.db
            .query("comments")
            .withIndex("by_user_and_timestamp", (q) =>
              q.eq("userId", user._id)
            )
            .order(order)
            .collect());

      const profileIds = Array.from(new Set(allComments.map((c) => c.tiktokProfileId)));
      const profiles = await Promise.all(profileIds.map((id) => ctx.db.get(id)));
      const profileMap = new Map(
        profiles.filter(Boolean).map((p) => [p!._id, p!])
      );

      const { results: matching } = buildSearchResults(
        allComments,
        profileMap,
        searchLower,
      );

      matching.sort((a, b) => {
        const aTime = a.commentTimestamp ? new Date(a.commentTimestamp).getTime() : a.scrapedAt;
        const bTime = b.commentTimestamp ? new Date(b.commentTimestamp).getTime() : b.scrapedAt;
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
        page: pageComments.map((c) => formatComment(c, profileMap.get(c.tiktokProfileId) ?? undefined)),
        isDone,
        continueCursor: isDone ? "" : String(nextCursor),
      };
    }

    const result = args.videoId
      ? await ctx.db
          .query("comments")
          .withIndex("by_user_video_and_timestamp", (q) =>
            q.eq("userId", user._id).eq("videoId", args.videoId)
          )
          .order(order)
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("comments")
          .withIndex("by_user_and_timestamp", (q) =>
            q.eq("userId", user._id)
          )
          .order(order)
          .paginate(args.paginationOpts);

    const profileIds = Array.from(new Set(result.page.map((c) => c.tiktokProfileId)));
    const profiles = await Promise.all(profileIds.map((id) => ctx.db.get(id)));
    const profileMap = new Map(
      profiles.filter(Boolean).map((p) => [p!._id, p!])
    );

    return {
      page: result.page.map((c) => formatComment(c, profileMap.get(c.tiktokProfileId) ?? undefined)),
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
    const videoIds = Array.from(new Set(args.comments.map(c => c.videoId).filter(Boolean)));
    console.log(`[DIAG] addBatch called with ${args.comments.length} comments`);
    console.log(`[DIAG] addBatch: Unique videoIds in batch:`, videoIds);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const plan: PlanName = user.subscriptionPlan ?? "free";
    const monthlyLimit = getMonthlyLimit(plan);
    const monthStart = getCurrentMonthStart();

    let monthlyCount = user.monthlyCommentCount ?? 0;
    if (!user.monthlyCommentResetAt || user.monthlyCommentResetAt < monthStart) {
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

    const profileCache = new Map<string, Awaited<ReturnType<typeof getOrCreateProfile>>>();
    const avatarsToStore: Array<{ profileId: Id<"tiktokProfiles">; tiktokUserId: string; tiktokAvatarUrl: string }> = [];
    const commentsToInsert: Array<{ tiktokProfileId: Id<"tiktokProfiles">; data: CommentInsertData }> = [];

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
      }
    }

    for (const avatar of avatarsToStore) {
      await ctx.scheduler.runAfter(0, internal.imageStorage.storeAvatar, {
        profileId: avatar.profileId,
        tiktokUserId: avatar.tiktokUserId,
        tiktokUrl: avatar.tiktokAvatarUrl,
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

    // TEMP DIAGNOSTIC
    console.log(`[DIAG] addBatch result: new=${newCount}, preexisting=${preexisting}, ignored=${ignored}, missingTiktokUserId=${missingTiktokUserId}`);

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
        q.eq("userId", user._id).eq("commentId", args.commentId)
      )
      .unique();

    if (!comment) {
      throw new Error("Comment not found");
    }

    let replyLimitReached = false;

    if (args.updates.repliedTo === true && !comment.repliedTo) {
      const plan: PlanName = user.subscriptionPlan ?? "free";
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
        monthlyReplyResetAt: user.monthlyReplyResetAt && user.monthlyReplyResetAt >= monthStart
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
        q.eq("userId", user._id).eq("commentId", args.commentId)
      )
      .unique();

    if (comment) {
      // Use helper to delete comment and update profile count
      await deleteComment(ctx, comment._id);
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

    const commentDocIds: Id<"comments">[] = [];
    for (const commentId of args.commentIds) {
      const comment = await ctx.db
        .query("comments")
        .withIndex("by_user_and_comment_id", (q) =>
          q.eq("userId", user._id).eq("commentId", commentId)
        )
        .unique();

      if (comment) {
        commentDocIds.push(comment._id);
      }
    }

    // Use helper to delete comments and update profile counts
    await deleteCommentsBatch(ctx, commentDocIds);
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
          c.comment.trim() === normalizedText
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

    const result = await ctx.db
      .query("comments")
      .paginate({
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
