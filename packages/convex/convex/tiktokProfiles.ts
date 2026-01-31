import { v } from "convex/values";
import { query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export async function getOrCreate(
  ctx: MutationCtx,
  userId: Id<"users">,
  data: { tiktokUserId: string; handle: string; profileUrl: string; avatarUrl?: string }
): Promise<Id<"tiktokProfiles">> {
  const existing = await ctx.db
    .query("tiktokProfiles")
    .withIndex("by_user_and_tiktok_id", (q) =>
      q.eq("userId", userId).eq("tiktokUserId", data.tiktokUserId)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      lastSeenAt: Date.now(),
      handle: data.handle,
      ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
    });
    return existing._id;
  }

  return await ctx.db.insert("tiktokProfiles", {
    userId,
    tiktokUserId: data.tiktokUserId,
    handle: data.handle,
    profileUrl: data.profileUrl,
    avatarUrl: data.avatarUrl,
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
  });
}

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

    const profiles = await ctx.db
      .query("tiktokProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return profiles.map((p) => ({
      id: p._id,
      tiktokUserId: p.tiktokUserId,
      handle: p.handle,
      profileUrl: p.profileUrl,
      avatarUrl: p.avatarUrl,
      firstSeenAt: new Date(p.firstSeenAt).toISOString(),
      lastSeenAt: new Date(p.lastSeenAt).toISOString(),
    }));
  },
});
