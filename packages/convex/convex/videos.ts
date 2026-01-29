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

    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return videos
      .sort((a, b) => a.order - b.order)
      .map((v) => ({
        id: `${v.profileHandle}-${v.videoId}`,
        videoId: v.videoId,
        thumbnailUrl: v.thumbnailUrl,
        videoUrl: v.videoUrl,
        profileHandle: v.profileHandle,
        order: v.order,
        scrapedAt: new Date(v.scrapedAt).toISOString(),
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

      await ctx.db.insert("videos", {
        userId: user._id,
        ...video,
      });
      stored++;
    }

    return { stored, duplicates };
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
    }
  },
});

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

    for (const videoId of args.videoIds) {
      const video = await ctx.db
        .query("videos")
        .withIndex("by_user_and_video_id", (q) =>
          q.eq("userId", user._id).eq("videoId", videoId)
        )
        .unique();

      if (video) {
        await ctx.db.delete(video._id);
      }
    }
  },
});
