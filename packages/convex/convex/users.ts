import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { WHITELISTED_EMAILS } from "./constants";

export const getOrCreate = mutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      if (args.email && !existing.email) {
        await ctx.db.patch(existing._id, { email: args.email });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      createdAt: Date.now(),
    });
  },
});

export const getAccessStatus = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return null;
    }

    const email = user.email ?? "";
    const emailList = WHITELISTED_EMAILS.map((e) => e.toLowerCase());
    const isAllowed = emailList.length === 0 || emailList.includes(email.toLowerCase());

    return {
      isAllowed,
      hasCompletedOnboarding: user.hasCompletedOnboarding ?? false,
      email,
    };
  },
});

export const markOnboardingComplete = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, { hasCompletedOnboarding: true });
  },
});
