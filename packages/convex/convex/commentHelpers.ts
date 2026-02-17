/**
 * Comment Helper Functions
 *
 * IMPORTANT: Always use these helpers when adding or removing comments.
 * They ensure the `commentCount` on tiktokProfiles stays in sync.
 *
 * DO NOT directly insert/delete from the comments table without using these helpers,
 * or the commenter counts will become inconsistent.
 */

import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export interface CommentInsertData {
  commentId: string;
  comment: string;
  scrapedAt: number;
  videoUrl?: string;
  commentTimestamp?: string;
  videoId?: string;
  parentCommentId?: string;
  isReply: boolean;
  replyCount?: number;
  source?: "app" | "scraped";
  handle?: string;
  profileUrl?: string;
  avatarUrl?: string;
}

/**
 * Insert a comment and increment the profile's commentCount.
 * Use this instead of directly inserting into the comments table.
 */
export async function insertComment(
  ctx: MutationCtx,
  userId: Id<"users">,
  tiktokProfileId: Id<"tiktokProfiles">,
  data: CommentInsertData
): Promise<Id<"comments">> {
  const commentDocId = await ctx.db.insert("comments", {
    userId,
    tiktokProfileId,
    ...data,
  });

  const profile = await ctx.db.get(tiktokProfileId);
  if (profile) {
    await ctx.db.patch(tiktokProfileId, {
      commentCount: (profile.commentCount ?? 0) + 1,
    });
  }

  const user = await ctx.db.get(userId);
  if (user) {
    await ctx.db.patch(userId, {
      commentCount: (user.commentCount ?? 0) + 1,
    });
  }

  return commentDocId;
}

/**
 * Batch insert comments and update profile commentCounts efficiently.
 * Groups count updates by profile to minimize database operations.
 *
 * Returns the number of comments actually inserted.
 */
export async function insertCommentsBatch(
  ctx: MutationCtx,
  userId: Id<"users">,
  comments: Array<{ tiktokProfileId: Id<"tiktokProfiles">; data: CommentInsertData }>
): Promise<number> {
  const profileIncrements = new Map<string, number>();

  for (const { tiktokProfileId, data } of comments) {
    await ctx.db.insert("comments", {
      userId,
      tiktokProfileId,
      ...data,
    });

    const profileIdStr = tiktokProfileId.toString();
    profileIncrements.set(
      profileIdStr,
      (profileIncrements.get(profileIdStr) ?? 0) + 1
    );
  }

  for (const [profileIdStr, increment] of Array.from(profileIncrements.entries())) {
    const profileId = profileIdStr as Id<"tiktokProfiles">;
    const profile = await ctx.db.get(profileId);
    if (profile) {
      await ctx.db.patch(profileId, {
        commentCount: (profile.commentCount ?? 0) + increment,
      });
    }
  }

  if (comments.length > 0) {
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.patch(userId, {
        commentCount: (user.commentCount ?? 0) + comments.length,
      });
    }
  }

  return comments.length;
}

/**
 * Delete a comment by its Convex document ID and decrement the profile's commentCount.
 * Use this instead of directly deleting from the comments table.
 */
export async function deleteComment(
  ctx: MutationCtx,
  commentDocId: Id<"comments">
): Promise<void> {
  const comment = await ctx.db.get(commentDocId);
  if (!comment) return;

  await ctx.db.delete(commentDocId);

  const profile = await ctx.db.get(comment.tiktokProfileId);
  if (profile) {
    await ctx.db.patch(comment.tiktokProfileId, {
      commentCount: Math.max(0, (profile.commentCount ?? 1) - 1),
    });
  }

  const user = await ctx.db.get(comment.userId);
  if (user) {
    await ctx.db.patch(comment.userId, {
      commentCount: Math.max(0, (user.commentCount ?? 1) - 1),
    });
  }
}

/**
 * Delete multiple comments and update their profiles' commentCounts.
 * More efficient than calling deleteComment in a loop when deleting many comments.
 */
export async function deleteCommentsBatch(
  ctx: MutationCtx,
  commentDocIds: Id<"comments">[]
): Promise<void> {
  const profileDecrements = new Map<string, number>();
  const userDecrements = new Map<string, number>();

  for (const docId of commentDocIds) {
    const comment = await ctx.db.get(docId);
    if (!comment) continue;

    await ctx.db.delete(docId);

    const profileIdStr = comment.tiktokProfileId.toString();
    profileDecrements.set(
      profileIdStr,
      (profileDecrements.get(profileIdStr) ?? 0) + 1
    );

    const userIdStr = comment.userId.toString();
    userDecrements.set(
      userIdStr,
      (userDecrements.get(userIdStr) ?? 0) + 1
    );
  }

  for (const [profileIdStr, decrement] of Array.from(profileDecrements.entries())) {
    const profileId = profileIdStr as Id<"tiktokProfiles">;
    const profile = await ctx.db.get(profileId);
    if (profile) {
      await ctx.db.patch(profileId, {
        commentCount: Math.max(0, (profile.commentCount ?? decrement) - decrement),
      });
    }
  }

  for (const [userIdStr, decrement] of Array.from(userDecrements.entries())) {
    const userId = userIdStr as Id<"users">;
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.patch(userId, {
        commentCount: Math.max(0, (user.commentCount ?? decrement) - decrement),
      });
    }
  }
}
