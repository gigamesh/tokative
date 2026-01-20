import { ScrapedUser, MessageType, ReplyProgress } from "../../types";
import { humanDelay, humanDelayWithJitter, humanClick, humanType } from "../../utils/dom";
import { SELECTORS, querySelector, querySelectorAll, waitForSelector } from "./selectors";

export async function replyToComment(
  user: ScrapedUser,
  replyMessage: string
): Promise<void> {
  console.log("[CommentReplier] Starting reply process for @" + user.handle);
  console.log("[CommentReplier] Expected comment:", user.comment.substring(0, 50));
  console.log("[CommentReplier] Video URL:", user.videoUrl);

  sendProgress(user.id, "finding", "Waiting for comments to load...");

  await humanDelayWithJitter("long");

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
  await humanDelayWithJitter("medium");

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

  await humanDelayWithJitter("medium");

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

  await humanDelayWithJitter("long");

  // Check if input was cleared (indicates successful post)
  console.log("[CommentReplier] After post, input textContent:", editableInput.textContent);

  console.log("[CommentReplier] Reply process complete");
  sendProgress(user.id, "complete", "Reply posted!");
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

function verifyComment(commentElement: Element, user: ScrapedUser): VerificationResult {
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

  // Extract comment text
  let foundComment = "";
  const textEls = commentElement.querySelectorAll('span');
  for (const textEl of textEls) {
    const text = textEl.textContent || "";
    if (text.length > foundComment.length && text.length < 500) {
      foundComment = text;
    }
  }
  foundComment = normalizeText(foundComment);

  console.log("[CommentReplier] Found comment:", foundComment.substring(0, 50));
  console.log("[CommentReplier] Expected comment:", targetComment.substring(0, 50));

  // Check if handle matches
  const handleMatches = foundHandle === targetHandle;

  // Check if comment text matches (allow partial match since text may be truncated)
  const commentMatches =
    foundComment.includes(targetComment) ||
    targetComment.includes(foundComment) ||
    (foundComment.length > 10 && targetComment.length > 10 &&
      (foundComment.substring(0, 20) === targetComment.substring(0, 20)));

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
