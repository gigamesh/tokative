import {
  MessageType,
  ExtensionMessage,
  ScrapedUser,
  MessageTemplate,
  ScrapeProgress,
  SendProgress,
  BulkSendProgress,
} from "../types";
import {
  getUsers,
  addUsers,
  updateUser,
  removeUser,
  removeUsers,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  getSettings,
  getAccountHandle,
  saveAccountHandle,
  getCommentLimit,
  saveCommentLimit,
} from "../utils/storage";

const activePorts = new Map<string, chrome.runtime.Port>();

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  console.log("[Background] Port connected:", port.name);
  activePorts.set(port.name, port);

  port.onMessage.addListener((message: ExtensionMessage) => {
    handlePortMessage(message, port);
  });

  port.onDisconnect.addListener(() => {
    console.log("[Background] Port disconnected:", port.name);
    activePorts.delete(port.name);
  });
});

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  console.log("[Background] Message received:", message.type);

  switch (message.type) {
    case MessageType.GET_STORED_USERS: {
      const users = await getUsers();
      const templates = await getTemplates();
      return { users, templates };
    }

    case MessageType.REMOVE_USER: {
      const { userId } = message.payload as { userId: string };
      await removeUser(userId);
      return { success: true };
    }

    case MessageType.REMOVE_USERS: {
      const { userIds } = message.payload as { userIds: string[] };
      await removeUsers(userIds);
      return { success: true };
    }

    case MessageType.UPDATE_USER: {
      const { userId, updates } = message.payload as {
        userId: string;
        updates: Partial<ScrapedUser>;
      };
      await updateUser(userId, updates);
      return { success: true };
    }

    case MessageType.GET_TEMPLATES: {
      const templates = await getTemplates();
      return { templates };
    }

    case MessageType.SAVE_TEMPLATE: {
      const { template } = message.payload as { template: MessageTemplate };
      await saveTemplate(template);
      return { success: true };
    }

    case MessageType.DELETE_TEMPLATE: {
      const { templateId } = message.payload as { templateId: string };
      await deleteTemplate(templateId);
      return { success: true };
    }

    case MessageType.OPEN_TIKTOK_TAB: {
      const tab = await chrome.tabs.create({
        url: "https://www.tiktok.com",
        active: true,
      });
      return { tabId: tab.id };
    }

    case MessageType.GET_TIKTOK_TAB: {
      const tabs = await chrome.tabs.query({
        url: "https://www.tiktok.com/*",
      });
      return { tab: tabs[0] || null };
    }

    case MessageType.CHECK_BRIDGE: {
      return { connected: true };
    }

    case MessageType.GET_ACCOUNT_HANDLE: {
      const handle = await getAccountHandle();
      return { handle };
    }

    case MessageType.SAVE_ACCOUNT_HANDLE: {
      const { handle } = message.payload as { handle: string };
      await saveAccountHandle(handle);
      return { success: true };
    }

    case MessageType.GET_COMMENT_LIMIT: {
      const limit = await getCommentLimit();
      return { limit };
    }

    case MessageType.SAVE_COMMENT_LIMIT: {
      const { limit } = message.payload as { limit: number };
      await saveCommentLimit(limit);
      return { success: true };
    }

    default:
      console.log("[Background] Unknown message type:", message.type);
      return null;
  }
}

async function handlePortMessage(
  message: ExtensionMessage,
  port: chrome.runtime.Port
): Promise<void> {
  console.log("[Background] Port message:", message.type);

  switch (message.type) {
    case MessageType.SCRAPE_COMMENTS_START: {
      const payload = message.payload as { handle?: string; maxComments?: number } | undefined;
      const handle = payload?.handle || await getAccountHandle();

      if (!handle) {
        port.postMessage({
          type: MessageType.SCRAPE_COMMENTS_ERROR,
          payload: { error: "No account handle set. Please enter your TikTok handle." },
        });
        return;
      }

      const tiktokTab = await findOrCreateTikTokTab(handle);
      if (!tiktokTab?.id) {
        port.postMessage({
          type: MessageType.SCRAPE_COMMENTS_ERROR,
          payload: { error: "Could not find or create TikTok tab" },
        });
        return;
      }

      await forwardToContentScript(tiktokTab.id, message, port);
      break;
    }

    case MessageType.SCRAPE_COMMENTS_PROGRESS: {
      const progress = message.payload as ScrapeProgress;
      if (progress.newUsers > 0) {
        const users = (message.payload as { users?: ScrapedUser[] }).users;
        if (users) {
          await addUsers(users);
        }
      }
      broadcastToDashboard(message);
      break;
    }

    case MessageType.SCRAPE_COMMENTS_COMPLETE: {
      const { users } = message.payload as { users: ScrapedUser[] };
      const added = await addUsers(users);
      broadcastToDashboard({
        type: MessageType.SCRAPE_COMMENTS_COMPLETE,
        payload: { totalAdded: added },
      });
      break;
    }

    case MessageType.SCRAPE_COMMENTS_ERROR: {
      broadcastToDashboard(message);
      break;
    }

    case MessageType.SEND_MESSAGE: {
      const { user, message: msgContent } = message.payload as {
        user: ScrapedUser;
        message: string;
      };
      await handleSendMessage(user, msgContent, port);
      break;
    }

    case MessageType.BULK_SEND_START: {
      const { userIds, templateId } = message.payload as {
        userIds: string[];
        templateId: string;
      };
      await handleBulkSend(userIds, templateId, port);
      break;
    }

    case MessageType.BULK_SEND_STOP: {
      break;
    }

    default:
      console.log("[Background] Unknown port message:", message.type);
  }
}

async function findOrCreateTikTokTab(handle?: string): Promise<chrome.tabs.Tab | null> {
  const targetUrl = handle
    ? `https://www.tiktok.com/@${handle}`
    : "https://www.tiktok.com";

  const tabs = await chrome.tabs.query({ url: "https://www.tiktok.com/*" });

  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id!, { url: targetUrl, active: true });
    await waitForTabLoad(tabs[0].id!);
    return chrome.tabs.get(tabs[0].id!);
  }

  const tab = await chrome.tabs.create({
    url: targetUrl,
    active: true,
  });

  if (tab.id) {
    await waitForTabLoad(tab.id);
  }

  return tab;
}

async function forwardToContentScript(
  tabId: number,
  message: ExtensionMessage,
  responsePort: chrome.runtime.Port
): Promise<void> {
  const maxRetries = 5;
  const retryDelay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[Background] Content script not ready, attempt ${attempt + 1}/${maxRetries}`);

      if (attempt === maxRetries - 1) {
        responsePort.postMessage({
          type: MessageType.SCRAPE_COMMENTS_ERROR,
          payload: { error: `Content script not responding: ${errorMessage}` },
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

function broadcastToDashboard(message: ExtensionMessage): void {
  activePorts.forEach((port) => {
    if (port.name === "dashboard") {
      port.postMessage(message);
    }
  });
}

async function handleSendMessage(
  user: ScrapedUser,
  messageContent: string,
  port: chrome.runtime.Port
): Promise<void> {
  try {
    port.postMessage({
      type: MessageType.SEND_MESSAGE_PROGRESS,
      payload: { userId: user.id, status: "opening" },
    });

    const tab = await chrome.tabs.create({
      url: user.profileUrl,
      active: false,
    });

    if (!tab.id) throw new Error("Failed to create tab");

    await waitForTabLoad(tab.id);

    chrome.tabs.sendMessage(tab.id, {
      type: MessageType.SEND_MESSAGE,
      payload: { user, message: messageContent },
    });

  } catch (error) {
    port.postMessage({
      type: MessageType.SEND_MESSAGE_ERROR,
      payload: {
        userId: user.id,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

async function handleBulkSend(
  userIds: string[],
  templateId: string,
  port: chrome.runtime.Port
): Promise<void> {
  const users = await getUsers();
  const templates = await getTemplates();
  const template = templates.find((t) => t.id === templateId);
  const settings = await getSettings();

  if (!template) {
    port.postMessage({
      type: MessageType.BULK_SEND_ERROR,
      payload: { error: "Template not found" },
    });
    return;
  }

  const targetUsers = users.filter((u) => userIds.includes(u.id) && !u.messageSent);

  const progress: BulkSendProgress = {
    total: targetUsers.length,
    completed: 0,
    failed: 0,
    status: "running",
  };

  for (const user of targetUsers) {
    progress.current = user.handle;
    port.postMessage({
      type: MessageType.BULK_SEND_PROGRESS,
      payload: progress,
    });

    try {
      const messageContent = template.content
        .replace(/\{\{handle\}\}/g, user.handle)
        .replace(/\{\{comment\}\}/g, user.comment);

      await handleSendMessage(user, messageContent, port);
      progress.completed++;

      await updateUser(user.id, {
        messageSent: true,
        sentAt: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, settings.messageDelay));
    } catch {
      progress.failed++;
      await updateUser(user.id, {
        messageError: "Failed to send message",
      });
    }
  }

  progress.status = "complete";
  port.postMessage({
    type: MessageType.BULK_SEND_COMPLETE,
    payload: progress,
  });
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout"));
    }, 30000);

    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1000);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

console.log("[Background] TikTok Buddy service worker initialized");
