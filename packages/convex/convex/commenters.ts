import { v } from "convex/values";
import { query } from "./_generated/server";

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
          replySent?: boolean;
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
        replySent: c.replySent,
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
