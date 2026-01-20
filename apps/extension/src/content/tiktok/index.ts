import { MessageType, ExtensionMessage, ScrapedUser } from "../../types";
import { guardExtensionContext } from "../../utils/dom";
import { startScraping, stopScraping, ScrapeOptions } from "./notifications-scraper";
import { sendMessageToUser } from "./profile-messenger";

let port: chrome.runtime.Port | null = null;

function init(): void {
  if (!guardExtensionContext()) {
    console.warn("[TikTok] Extension context invalid");
    return;
  }

  console.log("[TikTok] Content script initialized");

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
