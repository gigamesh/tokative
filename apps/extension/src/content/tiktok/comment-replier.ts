import { ScrapedComment, MessageType, ReplyProgress } from "../../types";
import { humanDelay, humanClick } from "../../utils/dom";
import { addScrapedComments } from "../../utils/storage";
import { CommentReplyError } from "../../utils/errors";
import { SELECTORS, closestMatch, querySelector, querySelectorAll, waitForSelector } from "./selectors";
import { VIDEO_SELECTORS } from "./video-selectors";
import { findRecentlyPostedReplyWithRetry } from "./video-scraper";
import { getLoadedConfig } from "../../config/loader";
import { logger } from "../../utils/logger";

export interface ReplyResult {
  postedReplyId?: string;
}

export async function replyToComment(
  user: ScrapedComment,
  replyMessage: string
): Promise<ReplyResult> {
  logger.log("[CommentReplier] Starting reply process for @" + user.handle);

  sendProgress(user.id, "finding", "Waiting for comments to load...");

  const firstComment = await waitForFirstComment();
  if (!firstComment) {
    throw new CommentReplyError("NO_COMMENTS_ON_VIDEO", "No comments found on this video", { commentId: user.id });
  }

  sendProgress(user.id, "finding", "Verifying comment...");

  const verification = verifyComment(firstComment, user);
  if (!verification.isMatch) {
    logger.warn(
      `[CommentReplier] Comment mismatch. Expected @${user.handle} but found @${verification.foundHandle}. ` +
      `Expected "${user.comment.substring(0, 30)}..." but found "${verification.foundComment.substring(0, 30)}..."`
    );
    throw new CommentReplyError("COMMENT_NOT_FOUND", "Comment not found", { commentId: user.id });
  }

  sendProgress(user.id, "replying", "Comment verified, clicking reply...");

  // Get the comment wrapper to find the reply button
  const commentWrapper = closestMatch(VIDEO_SELECTORS.commentItem, firstComment)
    || firstComment.parentElement?.parentElement?.parentElement;

  const replyButton = querySelector<HTMLElement>(SELECTORS.commentReplyButton, commentWrapper || firstComment);
  if (!replyButton) {
    throw new CommentReplyError("REPLY_BUTTON_NOT_FOUND", "Could not find reply button on comment", { commentId: user.id });
  }

  await humanClick(replyButton);

  sendProgress(user.id, "replying", "Waiting for reply input...");

  const config = getLoadedConfig();
  const commentInput = await waitForSelector<HTMLElement>(SELECTORS.commentInput, {
    timeout: config.timeouts.selectorWait,
  });

  if (!commentInput) {
    throw new CommentReplyError("COMMENT_INPUT_NOT_FOUND", "Could not find comment input field", { commentId: user.id });
  }

  let editableInput = commentInput.querySelector('[contenteditable="true"]') as HTMLElement || commentInput;

  await humanClick(editableInput);

  let mentioned = false;

  if (config.features?.enableMention !== false) {
    try {
      sendProgress(user.id, "replying", "Mentioning @" + user.handle + "...");
      await mentionUser(editableInput, user.handle, user.id);
      mentioned = true;
    } catch (error) {
      logger.error("[CommentReplier] Mention failed, proceeding without:", error);
      const freshInput = await waitForSelector<HTMLElement>(SELECTORS.commentInput, {
        timeout: config.timeouts.selectorWait,
      });
      if (!freshInput) {
        throw new CommentReplyError("COMMENT_INPUT_NOT_FOUND", "Lost comment input after failed mention attempt", { commentId: user.id });
      }
      editableInput = freshInput.querySelector('[contenteditable="true"]') as HTMLElement || freshInput;
      await humanClick(editableInput);
    }
  }

  sendProgress(user.id, "replying", "Typing reply...");

  await typeViaPaste(editableInput, (mentioned ? " " : "") + replyMessage);

  // Verify the reply text actually made it into the input
  await humanDelay("short");
  const inputContent = editableInput.textContent || "";
  if (!inputContent.includes(replyMessage.substring(0, 10))) {
    throw new CommentReplyError("REPLY_TEXT_NOT_ENTERED", "Reply text was not entered into the input field", { commentId: user.id });
  }

  sendProgress(user.id, "replying", "Posting reply...");

  const postButton = await waitForSelector<HTMLElement>(SELECTORS.commentPostButton, {
    timeout: config.timeouts.commentPost,
  });

  if (!postButton) {
    throw new CommentReplyError("POST_BUTTON_NOT_FOUND", "Could not find post button", { commentId: user.id });
  }

  await humanClick(postButton);

  sendProgress(user.id, "complete", "Reply posted!");

  const result: ReplyResult = {};

  if (config.features?.enableReplyDetection !== false) {
    try {
      await new Promise((resolve) => setTimeout(resolve, config.delays.postReply));

      const postedReply = await findRecentlyPostedReplyWithRetry({
        parentCommentId: user.id,
        replyText: replyMessage,
        maxAgeSeconds: config.timeouts.replyTimeout / 1000,
      });

      if (postedReply) {
        logger.log("[CommentReplier] Found posted reply:", postedReply.id);
        result.postedReplyId = postedReply.id;

        await addScrapedComments([postedReply]);
      } else {
        logger.warn("[CommentReplier] Could not find posted reply in DOM");
      }
    } catch (error) {
      logger.warn("[CommentReplier] Failed to extract/store posted reply:", error);
    }
  }

  return result;
}

/** Clicks the @ button, finds the user in the mention dropdown, and clicks them to insert a mention. */
async function mentionUser(editableInput: HTMLElement, handle: string, commentId: string): Promise<void> {
  const config = getLoadedConfig();

  const mentionButton = querySelector<HTMLElement>(SELECTORS.mentionButton);
  if (!mentionButton) {
    throw new CommentReplyError("MENTION_BUTTON_NOT_FOUND", "Could not find @ mention button", { commentId });
  }

  await humanClick(mentionButton);

  const dropdown = await waitForSelector<HTMLElement>(SELECTORS.mentionDropdown, {
    timeout: config.timeouts.mentionDropdownWait,
  });

  if (!dropdown) {
    throw new CommentReplyError("MENTION_DROPDOWN_NOT_FOUND", "Mention dropdown did not appear after clicking @ button", { commentId });
  }

  await humanDelay("short");

  editableInput.focus();
  document.execCommand("insertText", false, handle);

  const targetHandle = handle.toLowerCase();
  const pollInterval = 300;
  const maxAttempts = Math.ceil(config.timeouts.mentionDropdownWait / pollInterval);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const items = querySelectorAll<HTMLElement>(SELECTORS.mentionItem);
    for (const item of items) {
      const handleEl = querySelector<HTMLElement>(SELECTORS.mentionItemHandle, item);
      const itemHandle = (handleEl?.textContent || "").trim().toLowerCase();
      if (itemHandle === targetHandle) {
        const itemIndex = parseInt(item.getAttribute("data-index") || "0", 10);

        const container = item.closest('[class*="DivMentionSuggestionContainer"]') as HTMLElement;
        if (container) {
          container.focus();
          await humanDelay("micro");
        }

        const target = container || item;
        for (let i = 0; i <= itemIndex; i++) {
          target.dispatchEvent(new KeyboardEvent("keydown", {
            key: "ArrowDown", code: "ArrowDown", keyCode: 40, bubbles: true, cancelable: true,
          }));
          await humanDelay("micro");
        }
        await humanDelay("short");
        target.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true,
        }));
        await humanDelay("medium");

        const mentionTag = querySelector(SELECTORS.mentionTag, editableInput);
        if (!mentionTag) {
          throw new CommentReplyError("MENTION_NOT_INSERTED", `Clicked @${handle} but mention tag was not inserted into input`, { commentId });
        }
        return;
      }
    }
  }

  throw new CommentReplyError("MENTION_USER_NOT_FOUND", `Could not find @${handle} in mention dropdown after ${maxAttempts} attempts`, { commentId });
}

async function waitForFirstComment(): Promise<Element | null> {
  const config = getLoadedConfig();

  return new Promise((resolve) => {
    const checkComment = () => {
      const items = querySelectorAll(SELECTORS.commentItem);
      if (items.length > 0) {
        return items[0];
      }
      return null;
    };

    const firstCheck = checkComment();
    if (firstCheck) {
      resolve(firstCheck);
      return;
    }

    const observer = new MutationObserver(() => {
      const item = checkComment();
      if (item) {
        observer.disconnect();
        resolve(item);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      const items = querySelectorAll(SELECTORS.commentItem);
      resolve(items.length > 0 ? items[0] : null);
    }, config.timeouts.firstCommentWait);
  });
}

export interface VerificationResult {
  isMatch: boolean;
  foundHandle: string;
  foundComment: string;
}

export function verifyComment(commentElement: Element, user: ScrapedComment): VerificationResult {
  const targetHandle = user.handle.toLowerCase();
  const targetComment = normalizeText(user.comment);

  // The commentElement is the inner span[data-e2e="comment-level-1"]
  // We need to go up to the parent wrapper to find the username
  const commentWrapper = closestMatch(VIDEO_SELECTORS.commentItem, commentElement)
    || commentElement.parentElement?.parentElement?.parentElement;

  // Find the username link in the wrapper
  const handleLink = commentWrapper?.querySelector('a[href*="/@"]') as HTMLAnchorElement;

  const href = handleLink?.href || "";

  const handleMatch = href.match(/\/@([^/?]+)/);
  const foundHandle = handleMatch ? handleMatch[1].toLowerCase() : "";

  // Extract comment text from the wrapper to get full text in visual order
  // TikTok renders @mentions as separate links which can mess up textContent order
  const commentTextEl = commentWrapper ? querySelector(VIDEO_SELECTORS.commentTextInWrapper, commentWrapper) : null;
  const foundComment = normalizeText((commentTextEl || commentElement).textContent || "");

  // Check if handle matches
  const handleMatches = foundHandle === targetHandle;

  // Check if comment text matches
  // Due to @mentions being rendered as separate DOM elements, text order can vary
  // Use multiple matching strategies:
  const commentMatches = checkCommentTextMatch(targetComment, foundComment);

  return {
    isMatch: handleMatches && commentMatches,
    foundHandle,
    foundComment,
  };
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100);
}

export function checkCommentTextMatch(expected: string, found: string): boolean {
  // Direct containment checks
  if (found.includes(expected) || expected.includes(found)) {
    return true;
  }

  // First 20 chars match
  if (found.length > 10 && expected.length > 10 &&
      found.substring(0, 20) === expected.substring(0, 20)) {
    return true;
  }

  // Word overlap check - useful when @mentions cause text reordering
  // Extract significant words (4+ chars to skip common words)
  const getWords = (text: string) =>
    text.split(/\s+/).filter(w => w.length >= 4);

  const expectedWords = new Set(getWords(expected));
  const foundWords = getWords(found);

  if (expectedWords.size === 0 || foundWords.length === 0) {
    return false;
  }

  // Count how many significant words from found appear in expected
  const matchingWords = foundWords.filter(w => expectedWords.has(w)).length;
  const matchRatio = matchingWords / Math.max(expectedWords.size, foundWords.length);

  // If 50%+ of words match, consider it a match
  if (matchRatio >= 0.5) {
    return true;
  }

  return false;
}

async function typeViaPaste(element: HTMLElement, text: string): Promise<void> {
  element.focus();
  await humanDelay("micro");

  // Try using clipboard API to paste (works better with Draft.js)
  try {
    // Create a DataTransfer object to simulate paste
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer,
    });

    element.dispatchEvent(pasteEvent);

    await humanDelay("micro");

    // Check if paste worked
    if (element.textContent?.includes(text.substring(0, 5))) {
      return;
    }
  } catch (e) {
    // Paste failed, fall through to character-by-character input
  }

  // Fallback: try input events character by character
  for (const char of text) {
    const inputEvent = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: char,
    });
    element.dispatchEvent(inputEvent);

    const textInputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      inputType: 'insertText',
      data: char,
    });
    element.dispatchEvent(textInputEvent);

    await humanDelay("typing");
  }
}

function sendProgress(
  commentId: string,
  status: ReplyProgress["status"],
  message: string
): void {
  chrome.runtime.sendMessage({
    type: MessageType.REPLY_COMMENT_PROGRESS,
    payload: { commentId, status, message },
  });
}
