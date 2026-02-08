import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const listPaginated = query({
  args: {
    clerkId: v.string(),
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
        totalCount: 0,
      };
    }

    const searchLower = args.search?.toLowerCase().trim() || "";

    // Get all profiles for this user with comments
    // We need to filter and sort in memory since Convex doesn't support
    // complex sorting with filters on non-indexed fields
    const allProfiles = await ctx.db
      .query("tiktokProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter profiles with comments and optionally by search
    let filteredProfiles = allProfiles.filter(
      (p) => (p.commentCount ?? 0) > 0
    );

    if (searchLower) {
      filteredProfiles = filteredProfiles.filter((p) =>
        p.handle.toLowerCase().includes(searchLower)
      );
    }

    // Sort by commentCount desc, then by lastSeenAt desc
    filteredProfiles.sort((a, b) => {
      const countDiff = (b.commentCount ?? 0) - (a.commentCount ?? 0);
      if (countDiff !== 0) return countDiff;
      return b.lastSeenAt - a.lastSeenAt;
    });

    const totalCount = filteredProfiles.length;

    // Manual pagination since we're sorting in memory
    const cursor = args.paginationOpts.cursor
      ? parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const pageSize = args.paginationOpts.numItems;
    const pageProfiles = filteredProfiles.slice(cursor, cursor + pageSize);
    const nextCursor = cursor + pageSize;
    const isDone = nextCursor >= filteredProfiles.length;

    // Fetch comments for each profile in the page (limit per commenter to avoid document limits)
    const MAX_COMMENTS_PER_COMMENTER = 100;
    const commentersWithComments = await Promise.all(
      pageProfiles.map(async (profile) => {
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_user_and_profile", (q) =>
            q.eq("userId", user._id).eq("tiktokProfileId", profile._id)
          )
          .take(MAX_COMMENTS_PER_COMMENTER);

        // Sort comments by timestamp desc
        comments.sort((a, b) => {
          const aTime = a.commentTimestamp
            ? new Date(a.commentTimestamp).getTime()
            : a.scrapedAt;
          const bTime = b.commentTimestamp
            ? new Date(b.commentTimestamp).getTime()
            : b.scrapedAt;
          return bTime - aTime;
        });

        const mostRecentComment = comments[0];
        const mostRecentCommentAt = mostRecentComment
          ? mostRecentComment.commentTimestamp
            ? new Date(mostRecentComment.commentTimestamp).getTime()
            : mostRecentComment.scrapedAt
          : profile.lastSeenAt;

        return {
          profileId: profile._id.toString(),
          tiktokUserId: profile.tiktokUserId,
          handle: profile.handle,
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          commentCount: profile.commentCount ?? comments.length,
          mostRecentCommentAt,
          comments: comments.map((c) => ({
            id: c.commentId,
            tiktokUserId: profile.tiktokUserId,
            handle: profile.handle,
            comment: c.comment,
            scrapedAt: new Date(c.scrapedAt).toISOString(),
            profileUrl: profile.profileUrl,
            avatarUrl: profile.avatarUrl,
            videoUrl: c.videoUrl,
            repliedTo: c.repliedTo,
            repliedAt: c.repliedAt
              ? new Date(c.repliedAt).toISOString()
              : undefined,
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
            _convexId: c._id.toString(),
          })),
        };
      })
    );

    return {
      page: commentersWithComments,
      isDone,
      continueCursor: isDone ? "" : String(nextCursor),
      totalCount,
    };
  },
});

// Keep the old list query for backwards compatibility during migration
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
    const profiles = await Promise.all(profileIds.map((id) => ctx.db.get(id)));
    const profileMap = new Map(
      profiles.filter(Boolean).map((p) => [p!._id, p!])
    );

    const commenterMap = new Map<
      string,
      {
        profileId: string;
        tiktokUserId: string;
        handle: string;
        profileUrl: string;
        avatarUrl?: string;
        commentCount: number;
        mostRecentCommentAt: number;
        comments: Array<{
          id: string;
          handle: string;
          comment: string;
          scrapedAt: string;
          profileUrl: string;
          avatarUrl?: string;
          videoUrl?: string;
          repliedTo?: boolean;
          repliedAt?: string;
          replyError?: string;
          replyContent?: string;
          commentTimestamp?: string;
          commentId?: string;
          videoId?: string;
          parentCommentId?: string | null;
          isReply?: boolean;
          replyCount?: number;
          source?: "app" | "scraped";
          _convexId: string;
        }>;
      }
    >();

    for (const c of comments) {
      const profile = profileMap.get(c.tiktokProfileId);
      if (!profile) continue;

      const profileIdStr = c.tiktokProfileId.toString();
      const commentData = {
        id: c.commentId,
        handle: profile.handle ?? "",
        comment: c.comment,
        scrapedAt: new Date(c.scrapedAt).toISOString(),
        profileUrl: profile.profileUrl ?? "",
        avatarUrl: profile.avatarUrl,
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
        _convexId: c._id.toString(),
      };

      const commentTime = c.commentTimestamp
        ? new Date(c.commentTimestamp).getTime()
        : c.scrapedAt;

      if (commenterMap.has(profileIdStr)) {
        const existing = commenterMap.get(profileIdStr)!;
        existing.commentCount++;
        existing.comments.push(commentData);
        if (commentTime > existing.mostRecentCommentAt) {
          existing.mostRecentCommentAt = commentTime;
        }
      } else {
        commenterMap.set(profileIdStr, {
          profileId: profileIdStr,
          tiktokUserId: profile.tiktokUserId,
          handle: profile.handle,
          profileUrl: profile.profileUrl,
          avatarUrl: profile.avatarUrl,
          commentCount: 1,
          mostRecentCommentAt: commentTime,
          comments: [commentData],
        });
      }
    }

    const commenters = Array.from(commenterMap.values());

    commenters.sort((a, b) => {
      if (b.commentCount !== a.commentCount) {
        return b.commentCount - a.commentCount;
      }
      return b.mostRecentCommentAt - a.mostRecentCommentAt;
    });

    for (const commenter of commenters) {
      commenter.comments.sort((a, b) => {
        const aTime = a.commentTimestamp
          ? new Date(a.commentTimestamp).getTime()
          : new Date(a.scrapedAt).getTime();
        const bTime = b.commentTimestamp
          ? new Date(b.commentTimestamp).getTime()
          : new Date(b.scrapedAt).getTime();
        return bTime - aTime;
      });
    }

    return commenters;
  },
});

// Query to get total commenter count (profiles with comments)
export const getCount = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return 0;
    }

    const profiles = await ctx.db
      .query("tiktokProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return profiles.filter((p) => (p.commentCount ?? 0) > 0).length;
  },
});

// Migration: Backfill by processing profiles one at a time using take()
export const backfillBatch = mutation({
  args: {
    clerkId: v.string(),
    skip: v.optional(v.number()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const BATCH_SIZE = args.batchSize ?? 5;
    const skip = args.skip ?? 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return { updated: 0, error: "User not found", done: true };
    }

    // Use take() with a reasonable limit to get profiles
    const profiles = await ctx.db
      .query("tiktokProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(skip + BATCH_SIZE + 1); // +1 to check if there's more

    // Skip the ones we've already processed
    const batch = profiles.slice(skip, skip + BATCH_SIZE);
    const hasMore = profiles.length > skip + BATCH_SIZE;

    let updated = 0;

    for (const profile of batch) {
      // Count comments for this profile - use take with high limit instead of collect
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("tiktokProfileId"), profile._id))
        .take(10000);

      const count = comments.length;
      if (profile.commentCount !== count) {
        await ctx.db.patch(profile._id, { commentCount: count });
        updated++;
      }
    }

    console.log(`[Migration] Batch: updated ${updated}/${batch.length} profiles (skip=${skip})`);

    return {
      updated,
      processed: batch.length,
      done: !hasMore,
      nextSkip: hasMore ? skip + BATCH_SIZE : null,
    };
  },
});

// Migration: Get list of all user clerkIds to process
export const listUsersForMigration = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => u.clerkId);
  },
});
