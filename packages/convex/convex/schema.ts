import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
    hasCompletedOnboarding: v.optional(v.boolean()),
    createdAt: v.number(),
    commentCount: v.optional(v.number()),
    replyCount: v.optional(v.number()),
    videoCount: v.optional(v.number()),
    stripeCustomerId: v.optional(v.string()),
    subscriptionPlan: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("premium"))
    ),
    subscriptionStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("past_due"),
        v.literal("canceled"),
        v.literal("incomplete")
      )
    ),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionPriceId: v.optional(v.string()),
    subscriptionInterval: v.optional(
      v.union(v.literal("month"), v.literal("year"))
    ),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    monthlyCommentCount: v.optional(v.number()),
    monthlyCommentResetAt: v.optional(v.number()),
    monthlyReplyCount: v.optional(v.number()),
    monthlyReplyResetAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_stripe_customer_id", ["stripeCustomerId"]),

  tiktokProfiles: defineTable({
    userId: v.id("users"),
    tiktokUserId: v.string(),
    handle: v.string(),
    profileUrl: v.string(),
    avatarUrl: v.optional(v.string()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    commentCount: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_tiktok_id", ["userId", "tiktokUserId"])
    .index("by_user_and_comment_count", ["userId", "commentCount"]),

  comments: defineTable({
    userId: v.id("users"),
    commentId: v.string(),
    tiktokProfileId: v.id("tiktokProfiles"),
    comment: v.string(),
    scrapedAt: v.number(),
    videoUrl: v.optional(v.string()),
    // Denormalized: whether our app has replied to this comment.
    // Canonical data lives on the reply's own row (parentCommentId + source: "app").
    repliedTo: v.optional(v.boolean()),
    repliedAt: v.optional(v.number()),
    replyError: v.optional(v.string()),
    replyContent: v.optional(v.string()),
    commentTimestamp: v.optional(v.string()),
    videoId: v.optional(v.string()),
    parentCommentId: v.optional(v.string()),
    isReply: v.optional(v.boolean()),
    replyCount: v.optional(v.number()),
    source: v.optional(v.union(v.literal("app"), v.literal("scraped"))),
    detectedLanguage: v.optional(v.string()),
    translatedText: v.optional(v.string()),
    replyOriginalContent: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_video", ["userId", "videoId"])
    .index("by_user_and_comment_id", ["userId", "commentId"])
    .index("by_user_and_profile", ["userId", "tiktokProfileId"])
    .index("by_user_and_timestamp", ["userId", "commentTimestamp"])
    .index("by_user_video_and_timestamp", [
      "userId",
      "videoId",
      "commentTimestamp",
    ]),

  videos: defineTable({
    userId: v.id("users"),
    videoId: v.string(),
    thumbnailUrl: v.optional(v.string()),
    videoUrl: v.string(),
    profileHandle: v.string(),
    order: v.number(),
    scrapedAt: v.number(),
    commentsScraped: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_video_id", ["userId", "videoId"]),

  ignoreList: defineTable({
    userId: v.id("users"),
    text: v.string(),
    addedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_text", ["userId", "text"]),

  settings: defineTable({
    userId: v.id("users"),
    messageDelay: v.number(),
    scrollDelay: v.number(),
    postLimit: v.optional(v.number()),
    accountHandle: v.optional(v.string()),
    hasCompletedSetup: v.optional(v.boolean()),
    hideOwnReplies: v.optional(v.boolean()),
    deleteMissingComments: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),
});
