import type { ExtensionConfig } from "./types";

export const DEFAULT_CONFIG: ExtensionConfig = {
  minExtensionVersion: "1.0.0",

  selectors: {
    inbox: {
      activityButton: [
        '[data-e2e="nav-activity"]',
        '[aria-label="Activity"]',
      ],
      notificationPanel: [
        '[data-e2e="inbox-notifications"]',
      ],
      commentsTab: [
        '[data-e2e="comments"]',
        'button[role="tab"]:has-text("Comments")',
      ],
      inboxList: [
        '[data-e2e="inbox-list"]',
      ],
      inboxItem: [
        '[data-e2e="inbox-list-item"]',
      ],
      inboxTitle: [
        '[data-e2e="inbox-title"]',
      ],
      inboxContent: [
        '[data-e2e="inbox-content"]',
      ],
      profileLink: [
        'a[href*="/@"]',
      ],
      commentItem: [
        '[data-e2e="comment-level-1"]',
      ],
      commentUsername: [
        '[data-e2e="comment-username-1"]',
      ],
      commentText: [
        '[data-e2e="comment-level-1"] span[data-e2e="comment-text"]',
        '[data-e2e="comment-level-1"] > div > span',
      ],
      commentReplyButton: [
        '[data-e2e="comment-reply-1"]',
      ],
      commentInput: [
        '[data-e2e="comment-input"]',
        '[data-e2e="comment-input"] [contenteditable="true"]',
      ],
      commentPostButton: [
        '[data-e2e="comment-post"]',
      ],
    },

    video: {
      topLevelComment: [
        '[class*="DivCommentObjectWrapper"]',
      ],
      replyComment: [
        '[class*="DivReplyContainer"] [class*="DivCommentItemWrapper"]',
      ],
      commentCount: [
        '[class*="DivCommentCountContainer"] span',
        '[data-e2e="comment-count"]',
      ],
      commentButton: [
        '[data-e2e="comment-icon"]',
        'button[aria-label*="comment"]',
      ],
      videoGrid: [
        '[data-e2e="user-post-item-list"]',
        '[class*="DivVideoFeedV2"]',
      ],
      videoItem: [
        '[data-e2e="user-post-item"]',
        '[class*="DivItemContainerV2"]',
      ],
      videoThumbnail: [
        '[data-e2e="user-post-item"] img',
        '[class*="ImgPoster"]',
      ],
      videoModal: [
        '[class*="DivBrowserModeContainer"]',
        '[data-e2e="browse-video"]',
      ],
      videoCloseButton: [
        '[data-e2e="browse-close"]',
        '[class*="DivCloseIcon"]',
      ],
      commentsContainer: [
        '[class*="DivCommentListContainer"]',
      ],
      commentItem: [
        '[class*="DivCommentObjectWrapper"]',
        '[class*="DivCommentItemContainer"]',
        '[class*="DivCommentItemWrapper"]',
      ],
      commentContent: [
        '[class*="DivCommentContentContainer"]',
        '[class*="DivCommentContent"]',
      ],
      commentUsername: [
        '[data-e2e="comment-username-1"]',
        '[data-e2e="comment-username-1"] a',
      ],
      commentText: [
        '[data-e2e="comment-level-1"] span',
        'span[data-e2e="comment-level-1"]',
      ],
      commentStickerImage: [
        '[data-e2e="comment-thumbnail"]',
      ],
      commentReplyButton: [
        '[data-e2e="comment-reply-1"]',
      ],
      viewRepliesButton: [
        '[class*="DivViewRepliesContainer"]',
      ],
      replyContainer: [
        '[class*="DivReplyContainer"]',
      ],
      replyItem: [
        '[class*="DivReplyContainer"] [class*="DivCommentItemWrapper"]',
      ],
      commentsScroller: [
        '[class*="DivCommentMain"]',
        '[class*="DivCommentListContainer"]',
      ],
      videoMetaThumbnail: [
        'meta[property="og:image"]',
        'meta[property="og:image:secure_url"]',
        'meta[name="twitter:image"]',
      ],
      videoMetaUrl: [
        'meta[property="og:url"]',
        'meta[name="twitter:url"]',
      ],
    },
  },

  timeouts: {
    selectorWait: 10000,
    skeletonLoader: 3000,
    thumbnailLoad: 2000,
    modalClose: 5000,
    commentPost: 5000,
    rateLimitPause: 60000,
    tabLoad: 60000,
    replyTimeout: 60000,
    commentLoadWait: 10000,
    firstCommentWait: 15000,
  },

  delays: {
    profiles: {
      micro: { mean: 30, stdDev: 10, min: 10, max: 60 },
      short: { mean: 100, stdDev: 30, min: 50, max: 180 },
      medium: { mean: 200, stdDev: 60, min: 100, max: 350 },
      long: { mean: 400, stdDev: 100, min: 200, max: 700 },
      typing: { mean: 25, stdDev: 10, min: 10, max: 55 },
    },
    reactSettle: 500,
    scrollUp: 150,
    postReply: 300,
    fallbackContent: 2000,
  },

  limits: {
    maxClicksPerThread: 20,
    stableIterationsRequired: 3,
    consecutiveNoReplies: 3,
    contentScriptRetries: 20,
    contentScriptRetryDelay: 2000,
  },

  features: {
    enableReplyDetection: true,
    enableRateLimitAutoResume: true,
  },
};
