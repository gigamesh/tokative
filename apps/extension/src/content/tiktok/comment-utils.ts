import { isVisible } from "../../utils/dom";
import { closestMatch, querySelector, querySelectorAll } from "./selectors";
import { VIDEO_SELECTORS } from "./video-selectors";
import { getLoadedConfig } from "../../config/loader";
import { logger } from "../../utils/logger";

const tick = () => new Promise<void>((r) => setTimeout(r, getLoadedConfig().delays.tick));

/** Polls until replies load after clicking a "View X replies" button. */
export async function waitForReplyLoad(clickedButton: HTMLElement): Promise<void> {
  const config = getLoadedConfig();
  const initialText = clickedButton.textContent?.toLowerCase() || "";
  const maxWaitTime = config.timeouts.commentPost;
  const pollInterval = 200;
  let waited = 0;

  const parentComment = closestMatch(VIDEO_SELECTORS.commentItem, clickedButton);
  const replyContainer = parentComment
    ? querySelector(VIDEO_SELECTORS.replyContainer, parentComment)
    : null;
  const initialReplyCount = replyContainer
    ? querySelectorAll(VIDEO_SELECTORS.replyItem, replyContainer).length
    : 0;

  while (waited < maxWaitTime) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    waited += pollInterval;

    const currentText = clickedButton.textContent?.toLowerCase() || "";
    if (currentText !== initialText) {
      logger.log(`[CommentUtils] Button text changed: "${initialText}" -> "${currentText}"`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return;
    }

    const currentReplyCount = replyContainer
      ? querySelectorAll(VIDEO_SELECTORS.replyItem, replyContainer).length
      : 0;
    if (currentReplyCount > initialReplyCount) {
      logger.log(`[CommentUtils] Reply count increased: ${initialReplyCount} -> ${currentReplyCount}`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return;
    }

    if (!document.contains(clickedButton)) {
      logger.log(`[CommentUtils] Button removed from DOM`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return;
    }
  }

  logger.log(`[CommentUtils] Timeout waiting for replies to load (waited ${waited}ms)`);
}

/**
 * Expands the reply thread for a single parent comment element by
 * clicking "View X replies" / "View X more". Stops early if shouldStop
 * returns true (checked after each batch loads).
 */
export async function expandRepliesForParent(
  parentComment: Element,
  shouldStop?: () => boolean,
): Promise<void> {
  const config = getLoadedConfig();
  const maxClicks = config.limits.maxClicksPerThread;
  let clicks = 0;

  while (clicks < maxClicks) {
    const button = querySelector<HTMLElement>(VIDEO_SELECTORS.viewRepliesButton, parentComment);
    if (!button) break;

    button.scrollIntoView({ behavior: "instant", block: "center" });
    await tick();

    if (!isVisible(button)) break;

    const text = button.textContent?.toLowerCase() || "";
    if (text.includes("hide") || !text.includes("view")) break;

    logger.log(`[CommentUtils] Expanding: "${button.textContent?.trim()}"`);
    button.click();
    clicks++;

    await waitForReplyLoad(button);

    if (shouldStop?.()) {
      logger.log(`[CommentUtils] Target found after ${clicks} clicks, stopping expansion`);
      return;
    }
  }

  if (clicks > 0) {
    logger.log(`[CommentUtils] Thread expanded after ${clicks} clicks`);
  }
}
