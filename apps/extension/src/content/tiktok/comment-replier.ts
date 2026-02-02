import { ScrapedComment, MessageType, ReplyProgress } from "../../types";
import { humanDelay, humanClick } from "../../utils/dom";
import { addScrapedComments } from "../../utils/storage";
import { SELECTORS, querySelector, querySelectorAll, waitForSelector } from "./selectors";
import { findRecentlyPostedReplyWithRetry } from "./video-scraper";

export interface ReplyResult {
  postedReplyId?: string;
  postedReply?: ScrapedComment;
}

export async function replyToComment(
  user: ScrapedComment,
  replyMessage: string
): Promise<ReplyResult> {
  console.log("[CommentReplier] Starting reply process for @" + user.handle);
  console.log("[CommentReplier] Expected comment:", user.comment.substring(0, 50));
  console.log("[CommentReplier] Video URL:", user.videoUrl);

  sendProgress(user.id, "finding", "Waiting for comments to load...");

  await humanDelay("short");

  const firstComment = await waitForFirstComment();
  if (!firstComment) {
    throw new Error("No comments found on this video");
  }

  console.log("[CommentReplier] First comment element found");

  sendProgress(user.id, "finding", "Verifying comment...");

  const verification = verifyComment(firstComment, user);
  if (!verification.isMatch) {
    console.log("[CommentReplier] Verification failed:", verification);
    throw new Error(
      `Comment mismatch. Expected @${user.handle} but found @${verification.foundHandle}. ` +
      `Expected "${user.comment.substring(0, 30)}..." but found "${verification.foundComment.substring(0, 30)}..."`
    );
  }

  console.log("[CommentReplier] Comment verified successfully");
  sendProgress(user.id, "replying", "Comment verified, clicking reply...");

  // Get the comment wrapper to find the reply button
  const commentWrapper = firstComment.closest('[class*="DivCommentObjectWrapper"]')
    || firstComment.closest('[class*="CommentItem"]')
    || firstComment.parentElement?.parentElement?.parentElement;

  const replyButton = querySelector<HTMLElement>(SELECTORS.commentReplyButton, commentWrapper || firstComment);
  if (!replyButton) {
    console.log("[CommentReplier] Reply button not found. Wrapper HTML:", commentWrapper?.innerHTML?.substring(0, 500));
    throw new Error("Could not find reply button on comment");
  }

  console.log("[CommentReplier] Clicking reply button");
  await humanClick(replyButton);
  await humanDelay("short");

  sendProgress(user.id, "replying", "Waiting for reply input...");

  const commentInput = await waitForSelector<HTMLElement>(SELECTORS.commentInput, {
    timeout: 10000,
  });

  if (!commentInput) {
    console.log("[CommentReplier] Comment input not found");
    throw new Error("Could not find comment input field");
  }

  console.log("[CommentReplier] Found comment input");
  console.log("[CommentReplier] Comment input HTML:", commentInput.outerHTML.substring(0, 300));

  // Click on the input area first to ensure proper focus
  await humanClick(commentInput);

  const editableInput = commentInput.querySelector('[contenteditable="true"]') as HTMLElement || commentInput;
  console.log("[CommentReplier] Editable input found:", !!editableInput);
  console.log("[CommentReplier] Editable input contenteditable:", editableInput.getAttribute('contenteditable'));

  // Click directly on the editable area
  await humanClick(editableInput);

  console.log("[CommentReplier] Input focused, document.activeElement:", document.activeElement?.tagName, document.activeElement?.className?.substring(0, 50));

  sendProgress(user.id, "replying", "Typing reply...");

  console.log("[CommentReplier] Typing message:", replyMessage);

  // Use clipboard paste for Draft.js compatibility
  await typeViaPaste(editableInput, replyMessage);

  console.log("[CommentReplier] After typing, input textContent:", editableInput.textContent);
  console.log("[CommentReplier] After typing, input innerHTML:", editableInput.innerHTML?.substring(0, 200));

  await humanDelay("short");

  sendProgress(user.id, "replying", "Posting reply...");

  const postButton = await waitForSelector<HTMLElement>(SELECTORS.commentPostButton, {
    timeout: 5000,
  });

  console.log("[CommentReplier] Post button found:", !!postButton);
  if (postButton) {
    console.log("[CommentReplier] Post button HTML:", postButton.outerHTML.substring(0, 200));
    console.log("[CommentReplier] Post button disabled:", postButton.hasAttribute('disabled'), postButton.getAttribute('aria-disabled'));
  }

  if (!postButton) {
    console.log("[CommentReplier] Post button not found, trying Enter key");
    editableInput.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    }));
  } else {
    console.log("[CommentReplier] Clicking post button");
    await humanClick(postButton);
  }

  await humanDelay("medium");

  // Check if input was cleared (indicates successful post)
  console.log("[CommentReplier] After post, input textContent:", editableInput.textContent);

  console.log("[CommentReplier] Reply process complete");
  sendProgress(user.id, "complete", "Reply posted!");

  // Try to extract and store the posted reply
  const result: ReplyResult = {};

  try {
    console.log("[CommentReplier] Extracting posted reply...");

    // Wait a moment for TikTok to add the reply to DOM/React state
    await new Promise((resolve) => setTimeout(resolve, 500));

    const postedReply = await findRecentlyPostedReplyWithRetry({
      parentCommentId: user.id,
      replyText: replyMessage,
      maxAgeSeconds: 60,
    });

    if (postedReply) {
      console.log("[CommentReplier] Found posted reply:", postedReply.id);
      result.postedReplyId = postedReply.id;
      result.postedReply = postedReply;

      const storeResult = await addScrapedComments([postedReply]);
      console.log("[CommentReplier] Stored posted reply:", storeResult);
    } else {
      console.warn("[CommentReplier] Could not find posted reply in DOM");
    }
  } catch (error) {
    console.warn("[CommentReplier] Failed to extract/store posted reply:", error);
  }

  return result;
}

async function waitForFirstComment(): Promise<Element | null> {
  console.log("[CommentReplier] Waiting for first comment to load...");

  return new Promise((resolve) => {
    const checkComment = () => {
      const items = querySelectorAll(SELECTORS.commentItem);
      console.log("[CommentReplier] Found", items.length, "comment items");
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
      console.log("[CommentReplier] Timeout reached. Found", items.length, "comments");
      resolve(items.length > 0 ? items[0] : null);
    }, 15000);
  });
}

interface VerificationResult {
  isMatch: boolean;
  foundHandle: string;
  foundComment: string;
}

function verifyComment(commentElement: Element, user: ScrapedComment): VerificationResult {
  const targetHandle = user.handle.toLowerCase();
  const targetComment = normalizeText(user.comment);

  // The commentElement is the inner span[data-e2e="comment-level-1"]
  // We need to go up to the parent wrapper to find the username
  const commentWrapper = commentElement.closest('[class*="DivCommentObjectWrapper"]')
    || commentElement.closest('[class*="CommentItem"]')
    || commentElement.parentElement?.parentElement?.parentElement;

  console.log("[CommentReplier] Comment wrapper found:", !!commentWrapper);
  console.log("[CommentReplier] Comment wrapper class:", commentWrapper?.className?.substring(0, 100));

  // Find the username link in the wrapper
  const handleLink = commentWrapper?.querySelector('a[href*="/@"]') as HTMLAnchorElement;
  console.log("[CommentReplier] Handle link found:", !!handleLink);

  const href = handleLink?.href || "";
  console.log("[CommentReplier] Link href:", href);

  const handleMatch = href.match(/\/@([^/?]+)/);
  const foundHandle = handleMatch ? handleMatch[1].toLowerCase() : "";

  console.log("[CommentReplier] Found handle:", foundHandle, "| Expected:", targetHandle);

  // Extract comment text from the wrapper to get full text in visual order
  // TikTok renders @mentions as separate links which can mess up textContent order
  const commentTextEl = commentWrapper?.querySelector('[class*="CommentText"], [class*="DivComment"] > span, [data-e2e="comment-level-1"]');
  const foundComment = normalizeText((commentTextEl || commentElement).textContent || "");

  console.log("[CommentReplier] Found comment:", foundComment.substring(0, 50));
  console.log("[CommentReplier] Expected comment:", targetComment.substring(0, 50));

  // Check if handle matches
  const handleMatches = foundHandle === targetHandle;

  // Check if comment text matches
  // Due to @mentions being rendered as separate DOM elements, text order can vary
  // Use multiple matching strategies:
  const commentMatches = checkCommentTextMatch(targetComment, foundComment);

  console.log("[CommentReplier] Handle matches:", handleMatches, "| Comment matches:", commentMatches);

  return {
    isMatch: handleMatches && commentMatches,
    foundHandle,
    foundComment,
  };
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100);
}

function checkCommentTextMatch(expected: string, found: string): boolean {
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
    console.log(`[CommentReplier] Word match ratio: ${matchRatio.toFixed(2)} (${matchingWords} words)`);
    return true;
  }

  return false;
}

async function typeViaPaste(element: HTMLElement, text: string): Promise<void> {
  element.focus();
  await humanDelay("short");

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
    console.log("[CommentReplier] Paste event dispatched");

    await humanDelay("short");

    // Check if paste worked
    if (element.textContent?.includes(text.substring(0, 5))) {
      console.log("[CommentReplier] Paste successful");
      return;
    }
  } catch (e) {
    console.log("[CommentReplier] Paste failed, trying input events:", e);
  }

  // Fallback: try input events character by character
  console.log("[CommentReplier] Trying character-by-character input events");
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
  userId: string,
  status: ReplyProgress["status"],
  message: string
): void {
  chrome.runtime.sendMessage({
    type: MessageType.REPLY_COMMENT_PROGRESS,
    payload: { userId, status, message },
  });
}
