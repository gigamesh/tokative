/**
 * Comment Reply Logic
 *
 * IMPORTANT — @mention is mandatory, not optional:
 *
 * The @mention inserted via TikTok's mention dropdown is the ONLY mechanism
 * that triggers a notification to the recipient. Without it, the reply is
 * posted into the void — the user will never see it.
 *
 * If the mention fails for ANY reason (user not found in dropdown, dropdown
 * didn't appear, mention tag not inserted), the entire reply MUST be aborted.
 * Never fall back to posting without a mention. A reply without a mention is
 * worse than no reply at all — it wastes a reply and the recipient gets nothing.
 *
 * TikTok's mention search is unreliable. Some handles simply don't appear in
 * the dropdown results. When this happens, the correct behavior is to throw
 * MENTION_USER_NOT_FOUND and let the caller mark the reply as failed/skipped.
 */
import { ScrapedComment, MessageType, ReplyProgress } from "../../types";
import { addScrapedComments } from "../../utils/storage";
import { CommentReplyError } from "../../utils/errors";
import { isVisible } from "../../utils/dom";
import { SELECTORS, closestMatch, querySelector, querySelectorAll, waitForSelector } from "./selectors";
import { VIDEO_SELECTORS, getAllCommentElements } from "./video-selectors";
import { findRecentlyPostedReplyWithRetry } from "./video-scraper";
import { expandRepliesForParent } from "./comment-utils";
import { getLoadedConfig } from "../../config/loader";
import { logger } from "../../utils/logger";

/** Minimal delay to let React reconcile DOM changes between synthetic events. */
const tick = () => new Promise<void>((r) => setTimeout(r, getLoadedConfig().delays.tick));

export interface ReplyResult {
  postedReplyId?: string;
  postedReply?: ScrapedComment;
  detectionFailed?: boolean;
}

function checkLoggedIn(commentId: string): void {
  const loginButton = document.querySelector(
    '[data-e2e="nav-login-button"], [data-e2e="top-login-button"]'
  );
  if (loginButton) {
    throw new CommentReplyError(
      "USER_NOT_LOGGED_IN",
      "You must be logged into TikTok to reply to comments",
      { commentId }
    );
  }
}

export async function replyToComment(
  user: ScrapedComment,
  replyMessage: string
): Promise<ReplyResult> {
  logger.log("[CommentReplier] Starting reply process for @" + user.handle + (user.isReply ? " (reply comment)" : ""));

  sendProgress(user.id, "finding", "Waiting for comments to load...");

  const firstComment = await waitForFirstComment();
  if (!firstComment) {
    throw new CommentReplyError("NO_COMMENTS_ON_VIDEO", "No comments found on this video", { commentId: user.id });
  }

  sendProgress(user.id, "finding", "Verifying comment...");

  let targetComment = findTargetComment(user);

  if (!targetComment) {
    sendProgress(user.id, "finding", "Expanding reply threads...");
    const parentComments = querySelectorAll(VIDEO_SELECTORS.commentItem).filter(el => isVisible(el));

    for (const parent of parentComments) {
      await expandRepliesForParent(parent, () => {
        targetComment = findTargetComment(user);
        return targetComment !== null;
      });
      if (targetComment) break;
    }
  }

  if (!targetComment) {
    logger.warn(`[CommentReplier] Comment not found after expanding threads for @${user.handle}`);
    throw new CommentReplyError("COMMENT_NOT_FOUND", "Comment not found after expanding threads", { commentId: user.id });
  }

  sendProgress(user.id, "replying", "Comment verified, clicking reply...");

  const replyButton = findReplyButton(targetComment);
  if (!replyButton) {
    throw new CommentReplyError("REPLY_BUTTON_NOT_FOUND", "Could not find reply button on comment", { commentId: user.id });
  }

  replyButton.scrollIntoView({ behavior: "smooth", block: "center" });
  await tick();
  replyButton.click();
  await tick();

  checkLoggedIn(user.id);

  sendProgress(user.id, "replying", "Waiting for reply input...");

  const config = getLoadedConfig();
  const commentInput = await waitForSelector<HTMLElement>(SELECTORS.commentInput, {
    timeout: config.timeouts.selectorWait,
  });

  if (!commentInput) {
    checkLoggedIn(user.id);
    throw new CommentReplyError("COMMENT_INPUT_NOT_FOUND", "Could not find comment input field", { commentId: user.id });
  }

  let editableInput = commentInput.querySelector('[contenteditable="true"]') as HTMLElement || commentInput;

  editableInput.scrollIntoView({ behavior: "smooth", block: "center" });
  await tick();
  editableInput.click();
  await tick();

  let mentioned = false;

  if (config.features?.enableMention !== false) {
    sendProgress(user.id, "replying", "Mentioning @" + user.handle + "...");
    await mentionUser(editableInput, user.handle, user.id);
    mentioned = true;

    await tick();
    const mentionTag = querySelector(SELECTORS.mentionTag, editableInput);
    if (!mentionTag) {
      throw new CommentReplyError(
        "MENTION_NOT_LINKED",
        `Mention for @${user.handle} appeared but was removed — user likely has mention restrictions`,
        { commentId: user.id }
      );
    }

    moveCursorToEnd(editableInput);
  }

  sendProgress(user.id, "replying", "Typing reply...");

  if (mentioned) {
    moveCursorToEnd(editableInput);
    await tick();
  }

  const existingText = editableInput.textContent || "";
  const needsSpace = existingText.length > 0
    && !existingText.endsWith(" ")
    && !existingText.endsWith("\u00A0");
  await typeViaPaste(editableInput, (needsSpace ? " " : "") + replyMessage);

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

  postButton.scrollIntoView({ behavior: "smooth", block: "center" });
  await tick();
  postButton.click();
  await tick();

  sendProgress(user.id, "complete", "Reply posted!");

  const result: ReplyResult = {};

  if (config.features?.enableReplyDetection !== false) {
    try {
      await new Promise((resolve) => setTimeout(resolve, config.delays.postReply));

      const videoAuthor = window.location.pathname.match(/^\/@([^/?]+)/)?.[1];
      const topLevelCommentId = user.isReply ? (user.parentCommentId ?? undefined) : undefined;
      logger.log("[CommentReplier] Reply detection context:", {
        userId: user.id,
        userIsReply: user.isReply,
        userParentCommentId: user.parentCommentId,
        topLevelCommentId,
        videoAuthor,
        replyText: replyMessage.substring(0, 30),
      });
      const postedReply = await findRecentlyPostedReplyWithRetry({
        parentCommentId: user.id,
        topLevelCommentId,
        replyText: replyMessage,
        ourHandle: videoAuthor || "",
        maxAgeSeconds: config.timeouts.replyTimeout / 1000,
      });

      if (postedReply) {
        logger.log("[CommentReplier] Found posted reply:", JSON.stringify({
          id: postedReply.id,
          parentCommentId: postedReply.parentCommentId,
          replyToReplyId: postedReply.replyToReplyId,
          isReply: postedReply.isReply,
          handle: postedReply.handle,
          comment: postedReply.comment?.substring(0, 40),
        }));
        result.postedReplyId = postedReply.id;
        result.postedReply = postedReply;

        const storeResult = await addScrapedComments([postedReply]);
        logger.log("[CommentReplier] Stored posted reply:", JSON.stringify(storeResult));
      } else {
        logger.error("[CommentReplier] Could not find posted reply via React fiber (retries exhausted)");
        result.detectionFailed = true;
      }
    } catch (error) {
      logger.error("[CommentReplier] Failed to extract/store posted reply:", error);
      result.detectionFailed = true;
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

  mentionButton.scrollIntoView({ behavior: "smooth", block: "center" });
  await tick();
  mentionButton.click();
  await tick();

  const dropdown = await waitForSelector<HTMLElement>(SELECTORS.mentionDropdown, {
    timeout: config.timeouts.mentionDropdownAppear,
  });

  if (!dropdown) {
    throw new CommentReplyError("MENTION_DROPDOWN_NOT_FOUND", "Mention dropdown did not appear after clicking @ button", { commentId });
  }

  editableInput.focus();
  document.execCommand("insertText", false, handle);

  const targetHandle = handle.toLowerCase();
  const pollInterval = 150;
  const maxAttempts = Math.ceil(config.timeouts.mentionUserSearch / pollInterval);

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
        }

        const target = container || item;
        for (let i = 0; i <= itemIndex; i++) {
          target.dispatchEvent(new KeyboardEvent("keydown", {
            key: "ArrowDown", code: "ArrowDown", keyCode: 40, bubbles: true, cancelable: true,
          }));
          await tick();
        }
        target.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter", code: "Enter", keyCode: 13, bubbles: true, cancelable: true,
        }));
        await tick();

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

/**
 * Finds the reply button for a comment element. For top-level comments,
 * looks for [data-e2e="comment-reply-1"] directly. For reply comments
 * (inside DivReplyContainer), traverses up to the parent DivCommentObjectWrapper
 * and uses ITS reply button — this is TikTok's standard mechanism for replying
 * within a thread, and the @mention flow handles targeting the specific user.
 */
function findReplyButton(commentElement: Element): HTMLElement | null {
  const direct = querySelector<HTMLElement>(SELECTORS.commentReplyButton, commentElement);
  if (direct) return direct;

  const parentWrapper = closestMatch(VIDEO_SELECTORS.commentItem, commentElement);
  if (parentWrapper) {
    return querySelector<HTMLElement>(SELECTORS.commentReplyButton, parentWrapper);
  }
  return null;
}

/** Searches all visible comment elements (top-level + replies) for one matching the target. */
function findTargetComment(user: ScrapedComment): Element | null {
  const elements = getAllCommentElements();
  logger.log(`[CommentReplier] findTargetComment: searching ${elements.length} elements for @${user.handle} "${user.comment.substring(0, 30)}"`);
  for (const el of elements) {
    const verification = verifyComment(el, user);
    if (!verification.isMatch && verification.foundHandle === user.handle.toLowerCase()) {
      logger.log(`[CommentReplier] Handle matched @${verification.foundHandle} but text mismatched: "${verification.foundComment}" vs "${normalizeText(user.comment)}"`);
    }
    if (verification.isMatch) return el;
  }
  if (elements.length > 0) {
    const sample = elements.slice(0, 3).map(el => {
      const v = verifyComment(el, user);
      return `@${v.foundHandle}:"${v.foundComment.substring(0, 20)}"`;
    });
    logger.log(`[CommentReplier] No match. First 3 elements: ${sample.join(", ")}`);
  }
  return null;
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

  const handleLink = commentElement.querySelector('a[href*="/@"]') as HTMLAnchorElement;
  const href = handleLink?.href || "";
  const handleMatch = href.match(/\/@([^/?]+)/);
  const foundHandle = handleMatch ? handleMatch[1].toLowerCase() : "";

  const commentTextEl = querySelector(VIDEO_SELECTORS.commentTextInWrapper, commentElement);
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

function moveCursorToEnd(el: HTMLElement): void {
  el.focus();
  const selection = window.getSelection();
  if (selection) {
    selection.selectAllChildren(el);
    selection.collapseToEnd();
  }
}

async function typeViaPaste(element: HTMLElement, text: string): Promise<void> {
  element.focus();
  moveCursorToEnd(element);
  await tick();

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
    await tick();

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
