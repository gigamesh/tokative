import { getLoadedConfig } from "../../config/loader";
import { DEFAULT_CONFIG } from "../../config/defaults";

function getVideoSelectors(): Record<string, string[]> {
  try {
    return getLoadedConfig().selectors.video;
  } catch {
    return DEFAULT_CONFIG.selectors.video;
  }
}

export const TOP_LEVEL_COMMENT_SELECTOR = '[class*="DivCommentObjectWrapper"]';
export const REPLY_COMMENT_SELECTOR = '[class*="DivReplyContainer"] [class*="DivCommentItemWrapper"]';

export function getAllCommentElements(): Element[] {
  const selectors = getVideoSelectors();
  const topLevelSelector = selectors.topLevelComment?.[0] || TOP_LEVEL_COMMENT_SELECTOR;
  const replySelector = selectors.replyComment?.[0] || REPLY_COMMENT_SELECTOR;

  const topLevel = Array.from(document.querySelectorAll(topLevelSelector));
  const replies = Array.from(document.querySelectorAll(replySelector));

  return [...topLevel, ...replies].sort((a, b) => {
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

export const VIDEO_SELECTORS = {
  get commentCount() { return getVideoSelectors().commentCount; },
  get commentButton() { return getVideoSelectors().commentButton; },
  get videoGrid() { return getVideoSelectors().videoGrid; },
  get videoItem() { return getVideoSelectors().videoItem; },
  get videoThumbnail() { return getVideoSelectors().videoThumbnail; },
  get videoModal() { return getVideoSelectors().videoModal; },
  get videoCloseButton() { return getVideoSelectors().videoCloseButton; },
  get commentsContainer() { return getVideoSelectors().commentsContainer; },
  get commentItem() { return getVideoSelectors().commentItem; },
  get commentContent() { return getVideoSelectors().commentContent; },
  get commentUsername() { return getVideoSelectors().commentUsername; },
  get commentText() { return getVideoSelectors().commentText; },
  get commentStickerImage() { return getVideoSelectors().commentStickerImage; },
  get commentReplyButton() { return getVideoSelectors().commentReplyButton; },
  get viewRepliesButton() { return getVideoSelectors().viewRepliesButton; },
  get replyContainer() { return getVideoSelectors().replyContainer; },
  get replyItem() { return getVideoSelectors().replyItem; },
  get commentsScroller() { return getVideoSelectors().commentsScroller; },
  get videoMetaThumbnail() { return getVideoSelectors().videoMetaThumbnail; },
  get videoMetaUrl() { return getVideoSelectors().videoMetaUrl; },
};
