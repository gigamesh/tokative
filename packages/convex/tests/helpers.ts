import { expect } from "vitest";
import { Id } from "../convex/_generated/dataModel";
import { createTestContext } from "./test.setup";

export { createTestContext };

type TestContext = ReturnType<typeof createTestContext>;

export async function createTestUser(
  t: TestContext,
  clerkId = "test-user-123"
): Promise<Id<"users">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId,
      createdAt: Date.now(),
    });
  });
}

export function makeComment(overrides: Partial<{
  externalId: string;
  handle: string;
  comment: string;
  scrapedAt: number;
  profileUrl: string;
  videoId: string;
  commentId: string;
  parentCommentId: string;
  isReply: boolean;
}> = {}) {
  return {
    externalId: overrides.externalId ?? `comment-${Date.now()}-${Math.random()}`,
    handle: overrides.handle ?? "testuser",
    comment: overrides.comment ?? "Test comment",
    scrapedAt: overrides.scrapedAt ?? Date.now(),
    profileUrl: overrides.profileUrl ?? "https://tiktok.com/@testuser",
    videoId: overrides.videoId ?? "video123",
    commentId: overrides.commentId,
    parentCommentId: overrides.parentCommentId,
    isReply: overrides.isReply,
  };
}

export function makeVideo(overrides: Partial<{
  videoId: string;
  thumbnailUrl: string;
  videoUrl: string;
  profileHandle: string;
  order: number;
  scrapedAt: number;
}> = {}) {
  return {
    videoId: overrides.videoId ?? `video-${Date.now()}`,
    thumbnailUrl: overrides.thumbnailUrl ?? "https://example.com/thumb.jpg",
    videoUrl: overrides.videoUrl ?? "https://tiktok.com/@user/video/123",
    profileHandle: overrides.profileHandle ?? "testuser",
    order: overrides.order ?? 0,
    scrapedAt: overrides.scrapedAt ?? Date.now(),
  };
}

export { expect };
