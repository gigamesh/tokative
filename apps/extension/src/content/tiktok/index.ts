import { MessageType, ExtensionMessage, ScrapedUser } from "../../types";
import { guardExtensionContext } from "../../utils/dom";
import { startScraping, stopScraping, ScrapeOptions } from "./notifications-scraper";
import { sendMessageToUser } from "./profile-messenger";
import { replyToComment } from "./comment-replier";

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
    stopScraping();
  });
}

function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  console.log("[TikTok] Message received:", message.type);

  switch (message.type) {
    case MessageType.SCRAPE_COMMENTS_START: {
      if (port) {
        const options = message.payload as ScrapeOptions | undefined;
        startScraping(port, options);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Port not connected" });
      }
      return true;
    }

    case MessageType.SCRAPE_COMMENTS_STOP: {
      stopScraping();
      sendResponse({ success: true });
      return true;
    }

    case MessageType.SEND_MESSAGE: {
      const { user, message: msgContent } = message.payload as {
        user: ScrapedUser;
        message: string;
      };

      sendMessageToUser(user, msgContent)
        .then(() => {
          chrome.runtime.sendMessage({
            type: MessageType.SEND_MESSAGE_COMPLETE,
            payload: { userId: user.id },
          });
          sendResponse({ success: true });
        })
        .catch((error) => {
          chrome.runtime.sendMessage({
            type: MessageType.SEND_MESSAGE_ERROR,
            payload: {
              userId: user.id,
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    case MessageType.REPLY_COMMENT: {
      const { user, message: replyMsg } = message.payload as {
        user: ScrapedUser;
        message: string;
      };

      replyToComment(user, replyMsg)
        .then(() => {
          chrome.runtime.sendMessage({
            type: MessageType.REPLY_COMMENT_COMPLETE,
            payload: { userId: user.id },
          });
          sendResponse({ success: true });
        })
        .catch((error) => {
          chrome.runtime.sendMessage({
            type: MessageType.REPLY_COMMENT_ERROR,
            payload: {
              userId: user.id,
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
          sendResponse({ success: false, error: error.message });
        });

      return true;
    }

    default:
      return false;
  }
}

function handlePortMessage(message: ExtensionMessage): void {
  console.log("[TikTok] Port message:", message.type);

  switch (message.type) {
    case MessageType.SCRAPE_COMMENTS_START: {
      if (port) {
        const options = message.payload as ScrapeOptions | undefined;
        startScraping(port, options);
      }
      break;
    }

    case MessageType.SCRAPE_COMMENTS_STOP: {
      stopScraping();
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
