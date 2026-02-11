import { MessageType, ExtensionMessage, ScrapedComment } from "../../types";
import { guardExtensionContext } from "../../utils/dom";
import { replyToComment } from "./comment-replier";
import { showOverlay, updateOverlayProgress, updateOverlayPaused, updateOverlayResumed, updateOverlayComplete, updateOverlayError, hideOverlay } from "./overlay";
import { scrapeVideoComments, scrapeProfileVideoMetadata, cancelVideoScrape, pauseVideoScrape, resumeVideoScrape } from "./video-scraper";
import { loadConfig } from "../../config/loader";
import { logger } from "../../utils/logger";

let port: chrome.runtime.Port | null = null;

function injectMainWorldScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/extract-react-props.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

async function init(): Promise<void> {
  if (!guardExtensionContext()) {
    logger.warn("[TikTok] Extension context invalid");
    return;
  }

  logger.log("[TikTok] Content script initialized");

  // Load config early so it's available for all operations
  try {
    const config = await loadConfig();
    logger.log("[TikTok] Config loaded, version:", config.version);
  } catch (error) {
    logger.warn("[TikTok] Failed to load config, using defaults:", error);
  }

  // Inject main world script early so it's ready for React props extraction
  injectMainWorldScript();

  chrome.runtime.onMessage.addListener(handleMessage);

  port = chrome.runtime.connect({ name: "tiktok" });

  port.onMessage.addListener((message: ExtensionMessage) => {
    handlePortMessage(message);
  });

  port.onDisconnect.addListener(() => {
    logger.log("[TikTok] Port disconnected");
    port = null;
    cancelVideoScrape();
  });
}

function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  switch (message.type) {
    case MessageType.REPLY_COMMENT: {
      const { comment, message: replyMsg } = message.payload as {
        comment: ScrapedComment;
        message: string;
      };

      replyToComment(comment, replyMsg)
        .then((result) => {
          chrome.runtime.sendMessage({
            type: MessageType.REPLY_COMMENT_COMPLETE,
            payload: {
              commentId: comment.id,
              postedReplyId: result.postedReplyId,
            },
          });
          sendResponse({ success: true, postedReplyId: result.postedReplyId });
        })
        .catch((error) => {
          chrome.runtime.sendMessage({
            type: MessageType.REPLY_COMMENT_ERROR,
            payload: {
              commentId: comment.id,
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    case MessageType.SCRAPE_VIDEO_COMMENTS_START: {
      const { maxComments } = (message.payload as { maxComments?: number }) || {};
      showOverlay("comments", () => {
        cancelVideoScrape();
        hideOverlay();
        chrome.runtime.sendMessage({ type: MessageType.SCRAPE_VIDEO_COMMENTS_STOP });
      });

      scrapeVideoComments(maxComments, (progress) => {
        updateOverlayProgress(progress);
        chrome.runtime.sendMessage({
          type: MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS,
          payload: progress,
        });
      })
        .then((result) => {
          updateOverlayComplete(result.stats);
          chrome.runtime.sendMessage({
            type: MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE,
            payload: { comments: result.comments, stats: result.stats },
          });
          sendResponse({ success: true, comments: result.comments, stats: result.stats });
        })
        .catch((error) => {
          logger.error("[TikTok] Scraping error:", error);
          updateOverlayError(error instanceof Error ? error.message : "Unknown error");
          chrome.runtime.sendMessage({
            type: MessageType.SCRAPE_VIDEO_COMMENTS_ERROR,
            payload: {
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    case MessageType.SCRAPE_VIDEO_COMMENTS_STOP: {
      cancelVideoScrape();
      hideOverlay();
      sendResponse({ success: true });
      return true;
    }

    case MessageType.SCRAPE_VIDEOS_START: {
      const { postLimit } = (message.payload as { postLimit?: number }) || {};
      sendResponse({ success: true, started: true });
      showOverlay("profile", () => {
        cancelVideoScrape();
        hideOverlay();
        chrome.runtime.sendMessage({ type: MessageType.SCRAPE_VIDEOS_STOP });
      });

      scrapeProfileVideoMetadata(postLimit ?? Infinity, (progress) => {
        updateOverlayProgress(progress);
        chrome.runtime.sendMessage({
          type: MessageType.SCRAPE_VIDEOS_PROGRESS,
          payload: progress,
        });
      })
        .then(({ videos, limitReached }) => {
          updateOverlayComplete();
          chrome.runtime.sendMessage({
            type: MessageType.SCRAPE_VIDEOS_COMPLETE,
            payload: { videos, limitReached },
          });
        })
        .catch((error) => {
          updateOverlayError(error instanceof Error ? error.message : "Unknown error");
          chrome.runtime.sendMessage({
            type: MessageType.SCRAPE_VIDEOS_ERROR,
            payload: {
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
        });

      return true;
    }

    case MessageType.SCRAPE_VIDEOS_STOP: {
      cancelVideoScrape();
      hideOverlay();
      sendResponse({ success: true });
      return true;
    }

    case MessageType.SCRAPE_PAUSE: {
      pauseVideoScrape();
      updateOverlayPaused();
      sendResponse({ success: true });
      return true;
    }

    case MessageType.SCRAPE_RESUME: {
      resumeVideoScrape();
      updateOverlayResumed();
      sendResponse({ success: true });
      return true;
    }

    default:
      return false;
  }
}

function handlePortMessage(message: ExtensionMessage): void {
  switch (message.type) {
    case MessageType.SCRAPE_VIDEO_COMMENTS_START: {
      if (port) {
        const { maxComments } = (message.payload as { maxComments?: number }) || {};
        showOverlay("comments", () => {
          cancelVideoScrape();
          hideOverlay();
          chrome.runtime.sendMessage({ type: MessageType.SCRAPE_VIDEO_COMMENTS_STOP });
        });
        scrapeVideoComments(maxComments, (progress) => {
          updateOverlayProgress(progress);
          port?.postMessage({
            type: MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS,
            payload: progress,
          });
        })
          .then((result) => {
            updateOverlayComplete(result.stats);
            port?.postMessage({
              type: MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE,
              payload: { comments: result.comments, stats: result.stats },
            });
          })
          .catch((error) => {
            logger.error("[TikTok] Port: Scraping error:", error);
            updateOverlayError(error instanceof Error ? error.message : "Unknown error");
            port?.postMessage({
              type: MessageType.SCRAPE_VIDEO_COMMENTS_ERROR,
              payload: {
                error: error instanceof Error ? error.message : "Unknown error",
              },
            });
          });
      }
      break;
    }

    case MessageType.SCRAPE_VIDEO_COMMENTS_STOP: {
      cancelVideoScrape();
      hideOverlay();
      break;
    }

    case MessageType.SCRAPE_VIDEOS_START: {
      if (port) {
        const { postLimit } = (message.payload as { postLimit?: number }) || {};
        showOverlay("profile", () => {
          cancelVideoScrape();
          hideOverlay();
          chrome.runtime.sendMessage({ type: MessageType.SCRAPE_VIDEOS_STOP });
        });
        scrapeProfileVideoMetadata(postLimit ?? Infinity, (progress) => {
          updateOverlayProgress(progress);
          port?.postMessage({
            type: MessageType.SCRAPE_VIDEOS_PROGRESS,
            payload: progress,
          });
        })
          .then(({ videos, limitReached }) => {
            updateOverlayComplete();
            port?.postMessage({
              type: MessageType.SCRAPE_VIDEOS_COMPLETE,
              payload: { videos, limitReached },
            });
          })
          .catch((error) => {
            updateOverlayError(error instanceof Error ? error.message : "Unknown error");
            port?.postMessage({
              type: MessageType.SCRAPE_VIDEOS_ERROR,
              payload: {
                error: error instanceof Error ? error.message : "Unknown error",
              },
            });
          });
      }
      break;
    }

    case MessageType.SCRAPE_VIDEOS_STOP: {
      cancelVideoScrape();
      hideOverlay();
      break;
    }

    default:
      break;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
