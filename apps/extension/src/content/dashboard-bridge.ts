import { MessageType, ExtensionMessage } from "../types";
import { guardExtensionContext } from "../utils/dom";

const BRIDGE_ID = "tiktok-buddy-bridge";

let port: chrome.runtime.Port | null = null;

function initBridge(): void {
  if (!guardExtensionContext()) {
    console.warn("[Bridge] Extension context invalid");
    return;
  }

  if (document.getElementById(BRIDGE_ID)) {
    return;
  }

  const marker = document.createElement("div");
  marker.id = BRIDGE_ID;
  marker.style.display = "none";
  document.body.appendChild(marker);

  port = chrome.runtime.connect({ name: "dashboard" });

  port.onMessage.addListener((message: ExtensionMessage) => {
    window.postMessage(
      {
        ...message,
        source: "tiktok-buddy-extension",
      },
      "*"
    );
  });

  port.onDisconnect.addListener(() => {
    console.log("[Bridge] Port disconnected");
    port = null;
    marker.remove();
  });

  window.addEventListener("message", handleWindowMessage);

  window.postMessage(
    {
      type: MessageType.BRIDGE_READY,
      source: "tiktok-buddy-extension",
    },
    "*"
  );

  console.log("[Bridge] Dashboard bridge initialized");
}

function handleWindowMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  if (event.data?.source === "tiktok-buddy-extension") return;
  if (!event.data?.type) return;

  const message = event.data as ExtensionMessage;

  if (!guardExtensionContext()) {
    window.postMessage(
      {
        type: "EXTENSION_CONTEXT_INVALID",
        source: "tiktok-buddy-extension",
      },
      "*"
    );
    return;
  }

  if (message.type === MessageType.CHECK_BRIDGE) {
    window.postMessage(
      {
        type: MessageType.BRIDGE_READY,
        source: "tiktok-buddy-extension",
      },
      "*"
    );
    return;
  }

  if (isPortMessage(message.type)) {
    if (port) {
      port.postMessage(message);
    }
  } else {
    chrome.runtime.sendMessage(message).then((response) => {
      if (response) {
        window.postMessage(
          {
            type: getResponseType(message.type),
            payload: response,
            source: "tiktok-buddy-extension",
          },
          "*"
        );
      }
    });
  }
}

function isPortMessage(type: MessageType): boolean {
  return [
    MessageType.SCRAPE_COMMENTS_START,
    MessageType.SCRAPE_COMMENTS_STOP,
    MessageType.SEND_MESSAGE,
    MessageType.BULK_SEND_START,
    MessageType.BULK_SEND_STOP,
    MessageType.REPLY_COMMENT,
    MessageType.BULK_REPLY_START,
    MessageType.BULK_REPLY_STOP,
  ].includes(type);
}

function getResponseType(requestType: MessageType): MessageType {
  const responseMap: Partial<Record<MessageType, MessageType>> = {
    [MessageType.GET_STORED_USERS]: MessageType.USER_DATA_RESPONSE,
    [MessageType.GET_TEMPLATES]: MessageType.TEMPLATES_RESPONSE,
    [MessageType.GET_ACCOUNT_HANDLE]: MessageType.GET_ACCOUNT_HANDLE,
    [MessageType.SAVE_ACCOUNT_HANDLE]: MessageType.SAVE_ACCOUNT_HANDLE,
    [MessageType.GET_COMMENT_LIMIT]: MessageType.GET_COMMENT_LIMIT,
    [MessageType.SAVE_COMMENT_LIMIT]: MessageType.SAVE_COMMENT_LIMIT,
  };
  return responseMap[requestType] || requestType;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBridge);
} else {
  initBridge();
}
