import { MessageType, ExtensionMessage, EXTENSION_SOURCE } from "../types";
import { guardExtensionContext } from "../utils/dom";
import { logger } from "../utils/logger";

declare const DASHBOARD_URL_PLACEHOLDER: string;
const DASHBOARD_ORIGIN = DASHBOARD_URL_PLACEHOLDER;

const BRIDGE_ID = "tokative-bridge";

declare global {
  interface Window {
    __tokativeBridge?: {
      cleanup: () => void;
      handler: (event: MessageEvent) => void;
    };
  }
}

function initBridge(): void {
  if (!guardExtensionContext()) {
    logger.warn("[Bridge] Extension context invalid");
    return;
  }

  // Clean up any existing bridge from previous injection (e.g., after extension re-enable)
  if (window.__tokativeBridge) {
    window.removeEventListener("message", window.__tokativeBridge.handler);
    window.__tokativeBridge.cleanup();
    window.__tokativeBridge = undefined;
  }

  // Remove existing marker
  const existingMarker = document.getElementById(BRIDGE_ID);
  if (existingMarker) {
    existingMarker.remove();
  }

  const marker = document.createElement("div");
  marker.id = BRIDGE_ID;
  marker.style.display = "none";
  document.body.appendChild(marker);

  let port: chrome.runtime.Port | null = chrome.runtime.connect({ name: "dashboard" });

  port.onMessage.addListener((message: ExtensionMessage) => {
    window.postMessage(
      {
        ...message,
        source: EXTENSION_SOURCE,
      },
      DASHBOARD_ORIGIN
    );
  });

  port.onDisconnect.addListener(() => {
    port = null;
  });

  const handleWindowMessage = (event: MessageEvent): void => {
    if (event.source !== window) return;
    if (event.data?.source === EXTENSION_SOURCE) return;
    if (!event.data?.type) return;

    const message = event.data as ExtensionMessage;

    // Handle auth token response from the web app (source: "dashboard")
    if (message.type === MessageType.AUTH_TOKEN_RESPONSE && event.data?.source === "dashboard") {
      chrome.runtime.sendMessage(message).catch((error) => {
        logger.error("[Bridge] Error forwarding auth token:", error);
      });
      return;
    }

    if (message.type === MessageType.CHECK_BRIDGE) {
      // Only respond if extension context is still valid
      if (guardExtensionContext()) {
        window.postMessage(
          {
            type: MessageType.BRIDGE_READY,
            source: EXTENSION_SOURCE,
          },
          DASHBOARD_ORIGIN
        );
      }
      return;
    }

    if (!guardExtensionContext()) {
      window.postMessage(
        {
          type: "EXTENSION_CONTEXT_INVALID",
          source: EXTENSION_SOURCE,
        },
        DASHBOARD_ORIGIN
      );
      return;
    }

    if (isPortMessage(message.type)) {
      if (!port) {
        port = chrome.runtime.connect({ name: "dashboard" });
        port.onMessage.addListener((msg: ExtensionMessage) => {
          window.postMessage({ ...msg, source: EXTENSION_SOURCE }, DASHBOARD_ORIGIN);
        });
        port.onDisconnect.addListener(() => {
          port = null;
        });
      }
      port.postMessage(message);
    } else {
      chrome.runtime.sendMessage(message)
        .then((response) => {
          if (response) {
            window.postMessage(
              {
                type: getResponseType(message.type),
                payload: response,
                source: EXTENSION_SOURCE,
              },
              DASHBOARD_ORIGIN
            );
          }
        })
        .catch((error) => {
          logger.error("[Bridge] Error sending message:", error);
          window.postMessage(
            {
              type: getResponseType(message.type),
              payload: { error: error.message || "Extension communication error" },
              source: EXTENSION_SOURCE,
            },
            DASHBOARD_ORIGIN
          );
        });
    }
  };

  window.addEventListener("message", handleWindowMessage);

  // Listen for messages from background script (via chrome.tabs.sendMessage)
  const runtimeMessageHandler = (message: ExtensionMessage) => {
    window.postMessage(
      {
        ...message,
        source: EXTENSION_SOURCE,
      },
      DASHBOARD_ORIGIN
    );
  };
  chrome.runtime.onMessage.addListener(runtimeMessageHandler);

  // Store references for cleanup by next injection
  window.__tokativeBridge = {
    handler: handleWindowMessage,
    cleanup: () => {
      port?.disconnect();
      chrome.runtime.onMessage.removeListener(runtimeMessageHandler);
    },
  };

  window.postMessage(
    {
      type: MessageType.BRIDGE_READY,
      source: EXTENSION_SOURCE,
    },
    DASHBOARD_ORIGIN
  );
}

function isPortMessage(type: MessageType): boolean {
  const portMessages: MessageType[] = [
    MessageType.REPLY_COMMENT,
    MessageType.BULK_REPLY_START,
    MessageType.BULK_REPLY_STOP,
    MessageType.SCRAPE_VIDEOS_START,
    MessageType.SCRAPE_VIDEOS_STOP,
    MessageType.GET_VIDEO_COMMENTS,
    MessageType.GET_BATCH_COMMENTS,
    MessageType.SCRAPE_VIDEO_COMMENTS_STOP,
  ];
  return portMessages.includes(type);
}

function getResponseType(requestType: MessageType): MessageType {
  const responseMap: Partial<Record<MessageType, MessageType>> = {
    [MessageType.GET_SCRAPED_COMMENTS]: MessageType.SCRAPED_COMMENTS_RESPONSE,
    [MessageType.GET_ACCOUNT_HANDLE]: MessageType.GET_ACCOUNT_HANDLE,
    [MessageType.SAVE_ACCOUNT_HANDLE]: MessageType.SAVE_ACCOUNT_HANDLE,
    [MessageType.GET_COMMENT_LIMIT]: MessageType.GET_COMMENT_LIMIT,
    [MessageType.SAVE_COMMENT_LIMIT]: MessageType.SAVE_COMMENT_LIMIT,
    [MessageType.GET_POST_LIMIT]: MessageType.GET_POST_LIMIT,
    [MessageType.SAVE_POST_LIMIT]: MessageType.SAVE_POST_LIMIT,
    [MessageType.GET_STORED_VIDEOS]: MessageType.GET_STORED_VIDEOS,
    [MessageType.REMOVE_VIDEO]: MessageType.REMOVE_VIDEO,
    [MessageType.REMOVE_VIDEOS]: MessageType.REMOVE_VIDEOS,
  };
  return responseMap[requestType] || requestType;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBridge);
} else {
  initBridge();
}
