export const VIDEO_SELECTORS = {
  // Comment button to open comments panel
  commentButton: [
    '[data-e2e="comment-icon"]',
    'button[aria-label*="comment"]',
  ],

  // Profile page - video grid
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

  // Video modal/player
  videoModal: [
    '[class*="DivBrowserModeContainer"]',
    '[data-e2e="browse-video"]',
  ],

  videoCloseButton: [
    '[data-e2e="browse-close"]',
    '[class*="DivCloseIcon"]',
  ],

  // Comments section on video page
  commentsContainer: [
    '[class*="DivCommentListContainer"]',
  ],

  commentItem: [
    '[class*="DivCommentObjectWrapper"]',
    '[class*="DivCommentItemContainer"]',
    '[class*="DivCommentItemWrapper"]',
  ],

  commentUsername: [
    '[data-e2e="comment-username-1"]',
    '[data-e2e="comment-username-1"] a',
  ],

  commentText: [
    '[data-e2e="comment-level-1"] span',
    'span[data-e2e="comment-level-1"]',
  ],

  commentReplyButton: [
    '[data-e2e="comment-reply-1"]',
  ],

  // For scrolling to load more comments
  commentsScroller: [
    '[class*="DivCommentMain"]',
    '[class*="DivCommentListContainer"]',
  ],

  // Video metadata
  videoMetaThumbnail: [
    'meta[property="og:image"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="twitter:image"]',
  ],

  videoMetaUrl: [
    'meta[property="og:url"]',
    'meta[name="twitter:url"]',
  ],
};
