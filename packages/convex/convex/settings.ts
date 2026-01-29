import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_SETTINGS = {
  messageDelay: 2000,
  scrollDelay: 1000,
  commentLimit: 100,
  postLimit: 50,
};

export const get = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return DEFAULT_SETTINGS;
    }

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!settings) {
      return DEFAULT_SETTINGS;
    }

    return {
      messageDelay: settings.messageDelay,
      scrollDelay: settings.scrollDelay,
      commentLimit: settings.commentLimit ?? DEFAULT_SETTINGS.commentLimit,
      postLimit: settings.postLimit ?? DEFAULT_SETTINGS.postLimit,
    };
  },
});

export const update = mutation({
  args: {
    clerkId: v.string(),
    settings: v.object({
      messageDelay: v.optional(v.number()),
      scrollDelay: v.optional(v.number()),
      commentLimit: v.optional(v.number()),
      postLimit: v.optional(v.number()),
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

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args.settings);
    } else {
      await ctx.db.insert("settings", {
        userId: user._id,
        messageDelay: args.settings.messageDelay ?? DEFAULT_SETTINGS.messageDelay,
        scrollDelay: args.settings.scrollDelay ?? DEFAULT_SETTINGS.scrollDelay,
        commentLimit: args.settings.commentLimit ?? DEFAULT_SETTINGS.commentLimit,
        postLimit: args.settings.postLimit ?? DEFAULT_SETTINGS.postLimit,
      });
    }
  },
});
