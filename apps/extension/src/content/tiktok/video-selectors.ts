// Selectors used by both page-script and video-scraper for index alignment
export const TOP_LEVEL_COMMENT_SELECTOR = '[class*="DivCommentObjectWrapper"]';
export const REPLY_COMMENT_SELECTOR = '[class*="DivReplyContainer"] [class*="DivCommentItemWrapper"]';

export function getAllCommentElements(): Element[] {
  const topLevel = Array.from(document.querySelectorAll(TOP_LEVEL_COMMENT_SELECTOR));
  const replies = Array.from(document.querySelectorAll(REPLY_COMMENT_SELECTOR));

  // Combine and sort by document order for consistent indexing
  return [...topLevel, ...replies].sort((a, b) => {
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

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

  commentReplyButton: [
    '[data-e2e="comment-reply-1"]',
  ],

  // "View X replies" / "Hide" toggle button container
  // Structure: DivReplyContainer > DivViewMoreRepliesWrapper > DivViewMoreRepliesOptionsContainer > DivViewRepliesContainer
  viewRepliesButton: [
    '[class*="DivViewRepliesContainer"]',
  ],

  // Container that holds all replies for a parent comment
  replyContainer: [
    '[class*="DivReplyContainer"]',
  ],

  // Individual reply items (nested inside DivReplyContainer, use same wrapper as top-level)
  // Replies use data-e2e="comment-level-2" instead of comment-level-1
  replyItem: [
    '[class*="DivReplyContainer"] [class*="DivCommentItemWrapper"]',
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
