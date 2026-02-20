import { v } from "convex/values";
import { internalMutation, MutationCtx, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { deleteCommentsBatchDirect } from "./commentHelpers";

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

    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return videos
      .sort((a, b) => b.videoId.localeCompare(a.videoId))
      .map((v) => ({
        id: `${v.profileHandle}-${v.videoId}`,
        videoId: v.videoId,
        thumbnailUrl: v.thumbnailUrl,
        videoUrl: v.videoUrl,
        profileHandle: v.profileHandle,
        order: v.order,
        scrapedAt: new Date(v.scrapedAt).toISOString(),
        commentsScraped: v.commentsScraped,
        _convexId: v._id,
      }));
  },
});

const videoInput = {
  videoId: v.string(),
  thumbnailUrl: v.string(),
  videoUrl: v.string(),
  profileHandle: v.string(),
  order: v.number(),
  scrapedAt: v.number(),
};

export const addBatch = mutation({
  args: {
    clerkId: v.string(),
    videos: v.array(v.object(videoInput)),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    let stored = 0;
    let duplicates = 0;
    const thumbnailsToStore: Array<{ videoDbId: Id<"videos">; videoId: string; tiktokUrl: string }> = [];

    for (const video of args.videos) {
      const existing = await ctx.db
        .query("videos")
        .withIndex("by_user_and_video_id", (q) =>
          q.eq("userId", user._id).eq("videoId", video.videoId)
        )
        .unique();

      if (existing) {
        duplicates++;
        continue;
      }

      const videoDbId = await ctx.db.insert("videos", {
        userId: user._id,
        videoId: video.videoId,
        videoUrl: video.videoUrl,
        profileHandle: video.profileHandle,
        order: video.order,
        scrapedAt: video.scrapedAt,
      });

      if (video.thumbnailUrl) {
        thumbnailsToStore.push({
          videoDbId,
          videoId: video.videoId,
          tiktokUrl: video.thumbnailUrl,
        });
      }

      stored++;
    }

    for (const thumbnail of thumbnailsToStore) {
      await ctx.scheduler.runAfter(0, internal.imageStorage.storeThumbnail, {
        videoDbId: thumbnail.videoDbId,
        videoId: thumbnail.videoId,
        tiktokUrl: thumbnail.tiktokUrl,
      });
    }

    if (stored > 0) {
      const freshUser = await ctx.db.get(user._id);
      if (freshUser) {
        await ctx.db.patch(user._id, {
          videoCount: (freshUser.videoCount ?? 0) + stored,
        });
      }
    }

    return { stored, duplicates };
  },
});

export const update = mutation({
  args: {
    clerkId: v.string(),
    videoId: v.string(),
    updates: v.object({
      commentsScraped: v.optional(v.boolean()),
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

    const video = await ctx.db
      .query("videos")
      .withIndex("by_user_and_video_id", (q) =>
        q.eq("userId", user._id).eq("videoId", args.videoId)
      )
      .unique();

    if (video) {
      await ctx.db.patch(video._id, args.updates);
    }
  },
});

export const remove = mutation({
  args: {
    clerkId: v.string(),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const video = await ctx.db
      .query("videos")
      .withIndex("by_user_and_video_id", (q) =>
        q.eq("userId", user._id).eq("videoId", args.videoId)
      )
      .unique();

    if (video) {
      await ctx.db.delete(video._id);
      const freshUser = await ctx.db.get(user._id);
      if (freshUser) {
        await ctx.db.patch(user._id, {
          videoCount: Math.max(0, (freshUser.videoCount ?? 1) - 1),
        });
      }
    }
  },
});

const REMOVE_VIDEO_CHUNK_SIZE = 5;

export const removeBatch = mutation({
  args: {
    clerkId: v.string(),
    videoIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const chunk = args.videoIds.slice(0, REMOVE_VIDEO_CHUNK_SIZE);
    const overflow = args.videoIds.slice(REMOVE_VIDEO_CHUNK_SIZE);

    await removeVideosChunk(ctx, user._id, chunk);

    if (overflow.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.videos.removeBatchContinuation,
        { userId: user._id, videoIds: overflow },
      );
    }
  },
});

export const removeBatchContinuation = internalMutation({
  args: {
    userId: v.id("users"),
    videoIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const chunk = args.videoIds.slice(0, REMOVE_VIDEO_CHUNK_SIZE);
    const overflow = args.videoIds.slice(REMOVE_VIDEO_CHUNK_SIZE);

    await removeVideosChunk(ctx, args.userId, chunk);

    if (overflow.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.videos.removeBatchContinuation,
        { userId: args.userId, videoIds: overflow },
      );
    }
  },
});

/** Deletes a chunk of videos and their comments, updating all counters. */
async function removeVideosChunk(
  ctx: MutationCtx,
  userId: Id<"users">,
  videoIds: string[],
) {
  let deletedVideos = 0;

  for (const videoId of videoIds) {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("videoId", videoId)
      )
      .collect();

    await deleteCommentsBatchDirect(ctx, comments);

    const video = await ctx.db
      .query("videos")
      .withIndex("by_user_and_video_id", (q) =>
        q.eq("userId", userId).eq("videoId", videoId)
      )
      .unique();

    if (video) {
      await ctx.db.delete(video._id);
      deletedVideos++;
    }
  }

  if (deletedVideos > 0) {
    const freshUser = await ctx.db.get(userId);
    if (freshUser) {
      await ctx.db.patch(userId, {
        videoCount: Math.max(0, (freshUser.videoCount ?? deletedVideos) - deletedVideos),
      });
    }
  }
}
