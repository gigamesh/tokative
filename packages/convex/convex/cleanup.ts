/**
 * One-off cleanup script to fix stale data from partial video deletions.
 *
 * Run: npx convex run cleanup:run
 *
 * Splits work into chunked phases to stay under Convex's 4096-read limit:
 *   Phase 1: Delete orphaned comments (comments whose video no longer exists)
 *   Phase 2: Recount tiktokProfiles.commentCount, delete empty profiles
 *   Phase 3: Recount users.commentCount and users.videoCount
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const CHUNK = 500;

/** Entry point — kicks off phase 1 for each user. */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.scheduler.runAfter(0, internal.cleanup.deleteOrphanedComments, {
        userId: user._id,
        cursor: null,
      });
    }
    return { usersQueued: users.length };
  },
});

/** Phase 1: Delete orphaned comments in chunks, then move to phase 2. */
export const deleteOrphanedComments = internalMutation({
  args: { userId: v.id("users"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { userId, cursor }) => {
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user_and_video_id", (q) => q.eq("userId", userId))
      .collect();
    const validVideoIds = new Set(videos.map((v) => v.videoId));

    const result = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .paginate({ numItems: CHUNK, cursor: cursor as any });

    let deleted = 0;
    for (const comment of result.page) {
      if (comment.videoId && !validVideoIds.has(comment.videoId)) {
        await ctx.db.delete(comment._id);
        deleted++;
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.cleanup.deleteOrphanedComments, {
        userId,
        cursor: result.continueCursor,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.cleanup.fixProfileCounts, {
        userId,
        cursor: null,
      });
    }
  },
});

/** Phase 2: Recount profile commentCounts and delete empty profiles, then phase 3. */
export const fixProfileCounts = internalMutation({
  args: { userId: v.id("users"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { userId, cursor }) => {
    const result = await ctx.db
      .query("tiktokProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .paginate({ numItems: CHUNK, cursor: cursor as any });

    for (const profile of result.page) {
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_user_and_profile", (q) =>
          q.eq("userId", userId).eq("tiktokProfileId", profile._id)
        )
        .collect();
      const actual = comments.length;

      if (actual === 0) {
        await ctx.db.delete(profile._id);
      } else if ((profile.commentCount ?? 0) !== actual) {
        await ctx.db.patch(profile._id, { commentCount: actual });
      }
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.cleanup.fixProfileCounts, {
        userId,
        cursor: result.continueCursor,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.cleanup.fixUserCounts, { userId });
    }
  },
});

/** Phase 3: Recount user-level commentCount and videoCount. */
export const fixUserCounts = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return;

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user_and_video_id", (q) => q.eq("userId", userId))
      .collect();

    await ctx.db.patch(userId, {
      commentCount: comments.length,
      videoCount: videos.length,
    });
  },
});
