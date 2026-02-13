import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_SETTINGS = {
  messageDelay: 2000,
  scrollDelay: 1000,
  postLimit: 50,
  accountHandle: null as string | null,
  hasCompletedSetup: false,
  hideOwnReplies: false,
  deleteMissingComments: null as boolean | null,
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
      postLimit: settings.postLimit ?? DEFAULT_SETTINGS.postLimit,
      accountHandle: settings.accountHandle ?? DEFAULT_SETTINGS.accountHandle,
      hasCompletedSetup: settings.hasCompletedSetup ?? DEFAULT_SETTINGS.hasCompletedSetup,
      hideOwnReplies: settings.hideOwnReplies ?? DEFAULT_SETTINGS.hideOwnReplies,
      deleteMissingComments: settings.deleteMissingComments ?? DEFAULT_SETTINGS.deleteMissingComments,
    };
  },
});

export const update = mutation({
  args: {
    clerkId: v.string(),
    settings: v.object({
      messageDelay: v.optional(v.number()),
      scrollDelay: v.optional(v.number()),
      postLimit: v.optional(v.number()),
      accountHandle: v.optional(v.string()),
      hasCompletedSetup: v.optional(v.boolean()),
      hideOwnReplies: v.optional(v.boolean()),
      deleteMissingComments: v.optional(v.boolean()),
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
        postLimit: args.settings.postLimit ?? DEFAULT_SETTINGS.postLimit,
      });
    }
  },
});

export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
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
      postLimit: settings.postLimit ?? DEFAULT_SETTINGS.postLimit,
      accountHandle: settings.accountHandle ?? DEFAULT_SETTINGS.accountHandle,
      hasCompletedSetup: settings.hasCompletedSetup ?? DEFAULT_SETTINGS.hasCompletedSetup,
      hideOwnReplies: settings.hideOwnReplies ?? DEFAULT_SETTINGS.hideOwnReplies,
      deleteMissingComments: settings.deleteMissingComments ?? DEFAULT_SETTINGS.deleteMissingComments,
    };
  },
});

export const markSetupComplete = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        createdAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    }

    if (!user) {
      throw new Error("Failed to create user");
    }

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { hasCompletedSetup: true });
    } else {
      await ctx.db.insert("settings", {
        userId: user._id,
        messageDelay: DEFAULT_SETTINGS.messageDelay,
        scrollDelay: DEFAULT_SETTINGS.scrollDelay,
        postLimit: DEFAULT_SETTINGS.postLimit,
        hasCompletedSetup: true,
      });
    }
  },
});
