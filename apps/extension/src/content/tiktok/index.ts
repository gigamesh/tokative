import { MessageType, ExtensionMessage, ScrapedComment } from "../../types";
import { guardExtensionContext } from "../../utils/dom";
import { replyToComment } from "./comment-replier";
import { showOverlay, updateOverlayProgress, updateOverlayComplete, updateOverlayError, updateOverlayLimitReached, hideOverlay } from "./overlay";
import { scrapeVideoComments, scrapeProfileVideoMetadata, cancelVideoScrape, pauseVideoScrape, resumeVideoScrape, fetchVideoCommentsViaApi, injectReactExtractor } from "./video-scraper";
import { CommentLimitError } from "../../utils/storage";
import { ScrapeSetupError, CommentReplyError } from "../../utils/errors";
import { loadConfig } from "../../config/loader";
import { logger } from "../../utils/logger";
import { initSentry } from "../../utils/sentry";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs fetchVideoCommentsViaApi with a single retry for setup errors (panel not opening, params not captured, etc). */
async function fetchApiWithSetupRetry(
  onProgress: (stats: import("../../types").ScrapeStats) => void,
): Promise<import("./video-scraper").ScrapeCommentsResult> {
  try {
    return await fetchVideoCommentsViaApi(onProgress);
  } catch (error) {
    if (error instanceof ScrapeSetupError) {
      logger.warn("[TikTok] API setup failed, retrying in 3s...", error.code);
      await sleep(3000);
      return fetchVideoCommentsViaApi(onProgress);
    }
    throw error;
  }
}

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

  initSentry("content-tiktok");
  logger.log("[TikTok] Content script initialized");

  // Load config early so it's available for all operations
  try {
    const config = await loadConfig();
    logger.log("[TikTok] Config loaded");
  } catch (error) {
    logger.warn("[TikTok] Failed to load config, using defaults:", error);
  }

  // Inject main world scripts early so they're ready before TikTok's API calls
  injectMainWorldScript();
  injectReactExtractor();

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
          logger.error("[CommentReplier] Reply failed:", error);
          chrome.runtime.sendMessage({
            type: MessageType.REPLY_COMMENT_ERROR,
            payload: {
              commentId: comment.id,
              error: error instanceof Error ? error.message : "Unknown error",
              errorCode: error instanceof CommentReplyError ? error.code : undefined,
            },
          });
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    case MessageType.SCRAPE_VIDEO_COMMENTS_API_START: {
      showOverlay("comments", () => {
        cancelVideoScrape();
        hideOverlay();
        chrome.runtime.sendMessage({ type: MessageType.SCRAPE_VIDEO_COMMENTS_STOP });
      });

      fetchApiWithSetupRetry((stats) => {
        updateOverlayProgress({
          videosProcessed: 0,
          totalVideos: 1,
          commentsFound: stats.found,
          status: "scraping",
          message: `Found ${stats.found} (${stats.new} new)`,
          stats,
        });
        chrome.runtime.sendMessage({
          type: MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS,
          payload: {
            videosProcessed: 0,
            totalVideos: 1,
            commentsFound: stats.found,
            status: "scraping",
            message: `Found ${stats.found} (${stats.new} new)`,
            stats,
          },
        });
      })
        .then((result) => {
          updateOverlayComplete(result.stats);
          chrome.runtime.sendMessage({
            type: MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE,
            payload: { comments: result.comments, stats: result.stats, limitReached: result.limitReached },
          });
          sendResponse({ success: true });
        })
        .catch((error) => {
          logger.error("[TikTok] API scraping error:", error);
          if (error instanceof CommentLimitError) {
            updateOverlayLimitReached(error.monthlyLimit, error.currentCount, error.plan);
          } else {
            updateOverlayError(error instanceof Error ? error.message : "Unknown error");
          }
          chrome.runtime.sendMessage({
            type: MessageType.SCRAPE_VIDEO_COMMENTS_ERROR,
            payload: {
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
          sendResponse({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
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
            payload: { comments: result.comments, stats: result.stats, limitReached: result.limitReached },
          });
          sendResponse({ success: true, comments: result.comments, stats: result.stats, limitReached: result.limitReached });
        })
        .catch((error) => {
          logger.error("[TikTok] Scraping error:", error);
          if (error instanceof CommentLimitError) {
            updateOverlayLimitReached(error.monthlyLimit, error.currentCount, error.plan);
          } else {
            updateOverlayError(error instanceof Error ? error.message : "Unknown error");
          }
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
      sendResponse({ success: true });
      return true;
    }

    case MessageType.SCRAPE_RESUME: {
      resumeVideoScrape();
      sendResponse({ success: true });
      return true;
    }

    default:
      return false;
  }
}

function handlePortMessage(message: ExtensionMessage): void {
  switch (message.type) {
    case MessageType.SCRAPE_VIDEO_COMMENTS_API_START: {
      if (port) {
        showOverlay("comments", () => {
          cancelVideoScrape();
          hideOverlay();
          chrome.runtime.sendMessage({ type: MessageType.SCRAPE_VIDEO_COMMENTS_STOP });
        });
        fetchApiWithSetupRetry((stats) => {
          updateOverlayProgress({
            videosProcessed: 0,
            totalVideos: 1,
            commentsFound: stats.found,
            status: "scraping",
            message: `Found ${stats.found} (${stats.new} new)`,
            stats,
          });
          port?.postMessage({
            type: MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS,
            payload: {
              videosProcessed: 0,
              totalVideos: 1,
              commentsFound: stats.found,
              status: "scraping",
              message: `Found ${stats.found} (${stats.new} new)`,
              stats,
            },
          });
        })
          .then((result) => {
            updateOverlayComplete(result.stats);
            port?.postMessage({
              type: MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE,
              payload: { comments: result.comments, stats: result.stats, limitReached: result.limitReached },
            });
          })
          .catch((error) => {
            logger.error("[TikTok] Port: API scraping error:", error);
            if (error instanceof CommentLimitError) {
              updateOverlayLimitReached(error.monthlyLimit, error.currentCount, error.plan);
            } else {
              updateOverlayError(error instanceof Error ? error.message : "Unknown error");
            }
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
              payload: { comments: result.comments, stats: result.stats, limitReached: result.limitReached },
            });
          })
          .catch((error) => {
            logger.error("[TikTok] Port: Scraping error:", error);
            if (error instanceof CommentLimitError) {
              updateOverlayLimitReached(error.monthlyLimit, error.currentCount, error.plan);
            } else {
              updateOverlayError(error instanceof Error ? error.message : "Unknown error");
            }
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
