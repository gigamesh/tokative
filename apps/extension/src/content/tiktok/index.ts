import { MessageType, ExtensionMessage, ScrapedComment } from "../../types";
import { guardExtensionContext } from "../../utils/dom";
import { replyToComment } from "./comment-replier";
import { scrapeVideoComments, scrapeProfileVideoMetadata, cancelVideoScrape, pauseVideoScrape, resumeVideoScrape } from "./video-scraper";

let port: chrome.runtime.Port | null = null;

function injectMainWorldScript(): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/extract-react-props.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

function init(): void {
  if (!guardExtensionContext()) {
    console.warn("[TikTok] Extension context invalid");
    return;
  }

  console.log("[TikTok] Content script initialized");

  // Inject main world script early so it's ready for React props extraction
  injectMainWorldScript();

  chrome.runtime.onMessage.addListener(handleMessage);

  port = chrome.runtime.connect({ name: "tiktok" });

  port.onMessage.addListener((message: ExtensionMessage) => {
    handlePortMessage(message);
  });

  port.onDisconnect.addListener(() => {
    console.log("[TikTok] Port disconnected");
    port = null;
    cancelVideoScrape();
  });
}

function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  console.log("[TikTok] Message received:", message.type);

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
              postedReply: result.postedReply,
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
      console.log("[TikTok] SCRAPE_VIDEO_COMMENTS_START received, payload:", message.payload);
      const { maxComments } = (message.payload as { maxComments?: number }) || {};
      console.log("[TikTok] Starting scrapeVideoComments with maxComments:", maxComments);

      scrapeVideoComments(maxComments, (progress) => {
        console.log("[TikTok] Progress update:", progress);
        chrome.runtime.sendMessage({
          type: MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS,
          payload: progress,
        });
      })
        .then((result) => {
          console.log("[TikTok] Scraping complete, comments:", result.comments.length, "stats:", result.stats);
          chrome.runtime.sendMessage({
            type: MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE,
            payload: { comments: result.comments, stats: result.stats },
          });
          sendResponse({ success: true, comments: result.comments, stats: result.stats });
        })
        .catch((error) => {
          console.error("[TikTok] Scraping error:", error);
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
      sendResponse({ success: true });
      return true;
    }

    case MessageType.SCRAPE_VIDEOS_START: {
      const { postLimit } = (message.payload as { postLimit?: number }) || {};
      sendResponse({ success: true, started: true });

      scrapeProfileVideoMetadata(postLimit ?? Infinity, (progress) => {
        chrome.runtime.sendMessage({
          type: MessageType.SCRAPE_VIDEOS_PROGRESS,
          payload: progress,
        });
      })
        .then(({ videos, limitReached }) => {
          chrome.runtime.sendMessage({
            type: MessageType.SCRAPE_VIDEOS_COMPLETE,
            payload: { videos, limitReached },
          });
        })
        .catch((error) => {
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
  console.log("[TikTok] Port message:", message.type);

  switch (message.type) {
    case MessageType.SCRAPE_VIDEO_COMMENTS_START: {
      console.log("[TikTok] Port: SCRAPE_VIDEO_COMMENTS_START received, payload:", message.payload);
      if (port) {
        const { maxComments } = (message.payload as { maxComments?: number }) || {};
        console.log("[TikTok] Port: Starting scrapeVideoComments with maxComments:", maxComments);
        scrapeVideoComments(maxComments, (progress) => {
          console.log("[TikTok] Port: Progress update:", progress);
          port?.postMessage({
            type: MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS,
            payload: progress,
          });
        })
          .then((result) => {
            console.log("[TikTok] Port: Scraping complete, comments:", result.comments.length, "stats:", result.stats);
            port?.postMessage({
              type: MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE,
              payload: { comments: result.comments, stats: result.stats },
            });
          })
          .catch((error) => {
            console.error("[TikTok] Port: Scraping error:", error);
            port?.postMessage({
              type: MessageType.SCRAPE_VIDEO_COMMENTS_ERROR,
              payload: {
                error: error instanceof Error ? error.message : "Unknown error",
              },
            });
          });
      } else {
        console.log("[TikTok] Port: No port available for SCRAPE_VIDEO_COMMENTS_START");
      }
      break;
    }

    case MessageType.SCRAPE_VIDEO_COMMENTS_STOP: {
      cancelVideoScrape();
      break;
    }

    case MessageType.SCRAPE_VIDEOS_START: {
      if (port) {
        const { postLimit } = (message.payload as { postLimit?: number }) || {};
        scrapeProfileVideoMetadata(postLimit ?? Infinity, (progress) => {
          port?.postMessage({
            type: MessageType.SCRAPE_VIDEOS_PROGRESS,
            payload: progress,
          });
        })
          .then(({ videos, limitReached }) => {
            port?.postMessage({
              type: MessageType.SCRAPE_VIDEOS_COMPLETE,
              payload: { videos, limitReached },
            });
          })
          .catch((error) => {
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
      break;
    }

    default:
      console.log("[TikTok] Unknown port message:", message.type);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
