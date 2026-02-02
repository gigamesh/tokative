import { expect } from "vitest";
import { createTestContext } from "./test.setup";

export { createTestContext };

type TestContext = ReturnType<typeof createTestContext>;

export async function createTestUser(
  t: TestContext,
  clerkId = "test-user-123"
): Promise<string> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkId,
      createdAt: Date.now(),
    });
  });
  return clerkId;
}

export function makeComment(overrides: Partial<{
  commentId: string;
  tiktokUserId: string;
  handle: string;
  comment: string;
  scrapedAt: number;
  profileUrl: string;
  videoId: string;
  parentCommentId: string;
  isReply: boolean;
}> = {}) {
  return {
    commentId: overrides.commentId ?? `comment-${Date.now()}-${Math.random()}`,
    tiktokUserId: overrides.tiktokUserId ?? "7023701638964954118",
    handle: overrides.handle ?? "testuser",
    comment: overrides.comment ?? "Test comment",
    scrapedAt: overrides.scrapedAt ?? Date.now(),
    profileUrl: overrides.profileUrl ?? "https://tiktok.com/@testuser",
    videoId: overrides.videoId,
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
    thumbnailUrl: overrides.thumbnailUrl ?? "",
    videoUrl: overrides.videoUrl ?? "https://tiktok.com/@user/video/123",
    profileHandle: overrides.profileHandle ?? "testuser",
    order: overrides.order ?? 0,
    scrapedAt: overrides.scrapedAt ?? Date.now(),
  };
}

export { expect };
