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

    const entries = await ctx.db
      .query("ignoreList")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return entries.map((e) => ({
      text: e.text,
      addedAt: new Date(e.addedAt).toISOString(),
    }));
  },
});

export const add = mutation({
  args: {
    clerkId: v.string(),
    text: v.string(),
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
      .query("ignoreList")
      .withIndex("by_user_and_text", (q) =>
        q.eq("userId", user._id).eq("text", args.text)
      )
      .unique();

    if (existing) {
      return;
    }

    await ctx.db.insert("ignoreList", {
      userId: user._id,
      text: args.text,
      addedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    clerkId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const entry = await ctx.db
      .query("ignoreList")
      .withIndex("by_user_and_text", (q) =>
        q.eq("userId", user._id).eq("text", args.text)
      )
      .unique();

    if (entry) {
      await ctx.db.delete(entry._id);
    }
  },
});
