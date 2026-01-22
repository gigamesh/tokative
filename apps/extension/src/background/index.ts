import {
  MessageType,
  ExtensionMessage,
  ScrapedUser,
  ScrapedVideo,
  MessageTemplate,
  BulkSendProgress,
  BulkReplyProgress,
} from "../types";
import {
  getUsers,
  addUsers,
  updateUser,
  removeUser,
  removeUsers,
  getVideos,
  addVideos,
  updateVideo,
  removeVideo,
  removeVideos,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  getSettings,
  getAccountHandle,
  saveAccountHandle,
  getCommentLimit,
  saveCommentLimit,
  getPostLimit,
  savePostLimit,
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

    case MessageType.GET_POST_LIMIT: {
      const limit = await getPostLimit();
      return { limit };
    }

    case MessageType.SAVE_POST_LIMIT: {
      const { limit } = message.payload as { limit: number };
      await savePostLimit(limit);
      return { success: true };
    }

    case MessageType.GET_STORED_VIDEOS: {
      const videos = await getVideos();
      return { videos };
    }

    case MessageType.REMOVE_VIDEO: {
      const { videoId } = message.payload as { videoId: string };
      await removeVideo(videoId);
      return { success: true };
    }

    case MessageType.REMOVE_VIDEOS: {
      const { videoIds } = message.payload as { videoIds: string[] };
      await removeVideos(videoIds);
      return { success: true };
    }

    // Forward video scraping messages from content script to dashboard
    case MessageType.SCRAPE_VIDEOS_PROGRESS:
    case MessageType.SCRAPE_VIDEOS_ERROR: {
      broadcastToDashboard(message);
      return { success: true };
    }

    case MessageType.SCRAPE_VIDEOS_COMPLETE: {
      const { videos, limitReached } = message.payload as { videos: ScrapedVideo[]; limitReached?: boolean };
      const added = await addVideos(videos);
      broadcastToDashboard({
        type: MessageType.SCRAPE_VIDEOS_COMPLETE,
        payload: { totalAdded: added, videos, limitReached },
      });
      return { success: true };
    }

    // Forward get video comments messages
    case MessageType.GET_VIDEO_COMMENTS_PROGRESS:
    case MessageType.GET_VIDEO_COMMENTS_COMPLETE:
    case MessageType.GET_VIDEO_COMMENTS_ERROR: {
      broadcastToDashboard(message);
      return { success: true };
    }

    // Handle popup-triggered comment scraping
    case MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS: {
      broadcastToDashboard(message);
      return { success: true };
    }

    case MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE: {
      const { users } = message.payload as { users: ScrapedUser[] };
      await addUsers(users);
      const videoId = users[0]?.videoId;
      if (videoId) {
        await updateVideo(videoId, { commentsScraped: true });
      }
      broadcastToDashboard(message);
      return { success: true };
    }

    case MessageType.SCRAPE_VIDEO_COMMENTS_ERROR: {
      broadcastToDashboard(message);
      return { success: true };
    }

    // Forward reply messages from content script to dashboard
    case MessageType.REPLY_COMMENT_PROGRESS:
    case MessageType.REPLY_COMMENT_COMPLETE:
    case MessageType.REPLY_COMMENT_ERROR: {
      broadcastToDashboard(message);
      return { success: true };
    }

    // Forward send message messages from content script to dashboard
    case MessageType.SEND_MESSAGE_PROGRESS:
    case MessageType.SEND_MESSAGE_COMPLETE:
    case MessageType.SEND_MESSAGE_ERROR: {
      broadcastToDashboard(message);
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

    case MessageType.REPLY_COMMENT: {
      const { user, message: replyContent } = message.payload as {
        user: ScrapedUser;
        message: string;
      };
      await handleReplyComment(user, replyContent, port);
      break;
    }

    case MessageType.BULK_REPLY_START: {
      const { userIds, templateId } = message.payload as {
        userIds: string[];
        templateId: string;
      };
      await handleBulkReply(userIds, templateId, port);
      break;
    }

    case MessageType.BULK_REPLY_STOP: {
      break;
    }

    case MessageType.SCRAPE_VIDEOS_START: {
      try {
        const payload = message.payload as { profileHandle?: string; postLimit?: number } | undefined;
        const handle = payload?.profileHandle || await getAccountHandle();

        if (!handle) {
          port.postMessage({
            type: MessageType.SCRAPE_VIDEOS_ERROR,
            payload: { error: "No profile handle set. Please enter a TikTok handle." },
          });
          return;
        }

        const tiktokTab = await findOrCreateTikTokTab(handle);
        if (!tiktokTab?.id) {
          port.postMessage({
            type: MessageType.SCRAPE_VIDEOS_ERROR,
            payload: { error: "Could not find or create TikTok tab" },
          });
          return;
        }

        const postLimit = payload?.postLimit ?? await getPostLimit();
        const messageWithLimit = {
          ...message,
          payload: { ...payload, postLimit },
        };

        await forwardToContentScript(tiktokTab.id, messageWithLimit, port);
      } catch (error) {
        port.postMessage({
          type: MessageType.SCRAPE_VIDEOS_ERROR,
          payload: { error: error instanceof Error ? error.message : "Failed to start scraping" },
        });
      }
      break;
    }

    case MessageType.SCRAPE_VIDEOS_PROGRESS: {
      broadcastToDashboard(message);
      break;
    }

    case MessageType.SCRAPE_VIDEOS_COMPLETE: {
      const { videos } = message.payload as { videos: ScrapedVideo[] };
      const added = await addVideos(videos);
      broadcastToDashboard({
        type: MessageType.SCRAPE_VIDEOS_COMPLETE,
        payload: { totalAdded: added, videos },
      });
      break;
    }

    case MessageType.SCRAPE_VIDEOS_ERROR: {
      broadcastToDashboard(message);
      break;
    }

    case MessageType.SCRAPE_VIDEOS_STOP: {
      const tabs = await chrome.tabs.query({ url: "https://www.tiktok.com/*" });
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: MessageType.SCRAPE_VIDEOS_STOP });
      }
      break;
    }

    case MessageType.GET_VIDEO_COMMENTS: {
      const { videoId } = message.payload as { videoId: string };
      await handleGetVideoComments(videoId, port);
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
    await chrome.tabs.update(tabs[0].id!, { url: targetUrl });
    await waitForTabLoad(tabs[0].id!);
    return chrome.tabs.get(tabs[0].id!);
  }

  const tab = await chrome.tabs.create({
    url: targetUrl,
    active: false,
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
  const maxRetries = 20;
  const retryDelay = 2000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[Background] Content script not ready, attempt ${attempt + 1}/${maxRetries}`);

      if (attempt === maxRetries - 1) {
        responsePort.postMessage({
          type: MessageType.SCRAPE_VIDEOS_ERROR,
          payload: { error: `Content script not responding: ${errorMessage}` },
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

async function broadcastToDashboard(message: ExtensionMessage): Promise<void> {
  // Send via port connection
  activePorts.forEach((port) => {
    if (port.name === "dashboard") {
      port.postMessage(message);
    }
  });

  // Also send via tabs API as backup
  try {
    const tabs = await chrome.tabs.query({ url: "http://localhost:3000/*" });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors if content script isn't ready
        });
      }
    }
  } catch {
    // Ignore query errors
  }
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

async function handleReplyComment(
  user: ScrapedUser,
  replyContent: string,
  port: chrome.runtime.Port
): Promise<void> {
  try {
    if (!user.videoUrl) {
      throw new Error("No video URL available for this comment");
    }

    port.postMessage({
      type: MessageType.REPLY_COMMENT_PROGRESS,
      payload: { userId: user.id, status: "navigating", message: "Opening video..." },
    });

    const tab = await chrome.tabs.create({
      url: user.videoUrl,
      active: false,
    });

    if (!tab.id) throw new Error("Failed to create tab");

    await waitForTabLoad(tab.id);

    chrome.tabs.sendMessage(tab.id, {
      type: MessageType.REPLY_COMMENT,
      payload: { user, message: replyContent },
    });

  } catch (error) {
    port.postMessage({
      type: MessageType.REPLY_COMMENT_ERROR,
      payload: {
        userId: user.id,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

async function handleBulkReply(
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
      type: MessageType.BULK_REPLY_COMPLETE,
      payload: { error: "Template not found" },
    });
    return;
  }

  const targetUsers = users.filter((u) => userIds.includes(u.id) && !u.replySent && u.videoUrl);

  const progress: BulkReplyProgress = {
    total: targetUsers.length,
    completed: 0,
    failed: 0,
    status: "running",
  };

  for (const user of targetUsers) {
    progress.current = user.handle;
    port.postMessage({
      type: MessageType.BULK_REPLY_PROGRESS,
      payload: progress,
    });

    try {
      const replyContent = template.content
        .replace(/\{\{handle\}\}/g, user.handle)
        .replace(/\{\{comment\}\}/g, user.comment);

      await handleReplyComment(user, replyContent, port);
      progress.completed++;

      await updateUser(user.id, {
        replySent: true,
        repliedAt: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, settings.messageDelay));
    } catch {
      progress.failed++;
      await updateUser(user.id, {
        replyError: "Failed to post reply",
      });
    }
  }

  progress.status = "complete";
  port.postMessage({
    type: MessageType.BULK_REPLY_COMPLETE,
    payload: progress,
  });
}

async function handleGetVideoComments(
  videoId: string,
  port: chrome.runtime.Port
): Promise<void> {
  try {
    const videos = await getVideos();
    const video = videos.find((v) => v.videoId === videoId);

    if (!video) {
      port.postMessage({
        type: MessageType.GET_VIDEO_COMMENTS_ERROR,
        payload: { videoId, error: "Video not found in storage" },
      });
      return;
    }

    port.postMessage({
      type: MessageType.GET_VIDEO_COMMENTS_PROGRESS,
      payload: { videoId, status: "navigating", message: "Opening video..." },
    });

    const tab = await chrome.tabs.create({
      url: video.videoUrl,
      active: false,
    });

    if (!tab.id) {
      throw new Error("Failed to create tab");
    }

    await waitForTabLoad(tab.id);

    port.postMessage({
      type: MessageType.GET_VIDEO_COMMENTS_PROGRESS,
      payload: { videoId, status: "scraping", message: "Scraping comments..." },
    });

    const commentLimit = await getCommentLimit();

    const responseHandler = (msg: ExtensionMessage) => {
      if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS) {
        port.postMessage({
          type: MessageType.GET_VIDEO_COMMENTS_PROGRESS,
          payload: { videoId, ...msg.payload },
        });
      } else if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE) {
        const { users: scrapedUsers } = msg.payload as { users: ScrapedUser[] };
        addUsers(scrapedUsers);
        updateVideo(videoId, { commentsScraped: true });
        port.postMessage({
          type: MessageType.GET_VIDEO_COMMENTS_COMPLETE,
          payload: { videoId },
        });
        broadcastToDashboard(msg);
        chrome.runtime.onMessage.removeListener(responseHandler);
        chrome.tabs.remove(tab.id!);
      } else if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_ERROR) {
        port.postMessage({
          type: MessageType.GET_VIDEO_COMMENTS_ERROR,
          payload: { videoId, ...msg.payload },
        });
        chrome.runtime.onMessage.removeListener(responseHandler);
        chrome.tabs.remove(tab.id!);
      }
    };

    chrome.runtime.onMessage.addListener(responseHandler);

    chrome.tabs.sendMessage(tab.id, {
      type: MessageType.SCRAPE_VIDEO_COMMENTS_START,
      payload: { maxComments: commentLimit, videoThumbnailUrl: video.thumbnailUrl },
    });

  } catch (error) {
    port.postMessage({
      type: MessageType.GET_VIDEO_COMMENTS_ERROR,
      payload: {
        videoId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout"));
    }, 60000);

    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 2000);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

console.log("[Background] TikTok Buddy service worker initialized");
