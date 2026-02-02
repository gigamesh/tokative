import {
  BulkReplyProgress,
  ExtensionMessage,
  MessageType,
  ScrapedComment,
  ScrapedVideo,
} from "../types";
import { colors } from "@tokative/shared";
import { setAuthToken } from "../utils/convex-api";
import {
  addScrapedComments,
  addToIgnoreList,
  addVideos,
  clearRateLimitState,
  clearScrapingState,
  getAccountHandle,
  getCommentLimit,
  getIgnoreList,
  getPostLimit,
  getRateLimitState,
  getScrapedComments,
  getScrapingState,
  getSettings,
  getVideos,
  recordRateLimitError,
  removeFromIgnoreList,
  removeScrapedComment,
  removeScrapedComments,
  removeVideo,
  removeVideos,
  saveAccountHandle,
  saveCommentLimit,
  savePostLimit,
  saveScrapingState,
  updateScrapedComment,
  updateVideo,
} from "../utils/storage";

const activePorts = new Map<string, chrome.runtime.Port>();
let activeScrapingTabId: number | null = null;
let isBatchScraping = false;
let batchCancelled = false;
const closingTabsIntentionally = new Set<number>();

async function getDashboardTabIndex(): Promise<number | undefined> {
  try {
    const tabs = await chrome.tabs.query({ url: "http://localhost:3000/*" });
    if (tabs.length > 0 && tabs[0].index !== undefined) {
      return tabs[0].index + 1;
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

async function focusDashboardTab(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ url: "http://localhost:3000/*" });
    if (tabs.length > 0 && tabs[0].id) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId) {
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    }
  } catch {
    // Ignore errors
  }
}

function updateBadge(text: string, color: string): void {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

function clearBadge(): void {
  chrome.action.setBadgeText({ text: "" });
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  // Check if we're closing this tab intentionally (after successful scraping)
  if (closingTabsIntentionally.has(tabId)) {
    closingTabsIntentionally.delete(tabId);
    // Still clean up state but don't broadcast error
    if (activeScrapingTabId === tabId) {
      activeScrapingTabId = null;
      isBatchScraping = false;
      await clearScrapingState();
      clearBadge();
    }
    return;
  }

  if (activeScrapingTabId && tabId === activeScrapingTabId) {
    console.log("[Background] Scraping tab was closed by user");
    const wasBatchScraping = isBatchScraping;
    activeScrapingTabId = null;
    isBatchScraping = false;
    await clearScrapingState();
    clearBadge();

    const errorType = wasBatchScraping
      ? MessageType.GET_BATCH_COMMENTS_ERROR
      : MessageType.GET_VIDEO_COMMENTS_ERROR;
    broadcastToDashboard({
      type: errorType,
      payload: { error: "Scraping cancelled - TikTok tab was closed" },
    });
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Get the scraping tab ID from runtime variable or storage
  let scrapingTabId = activeScrapingTabId;

  if (!scrapingTabId) {
    // Service worker may have restarted - check storage for active scraping state
    const state = await getScrapingState();
    if (state.isActive && state.tabId) {
      scrapingTabId = state.tabId;
      activeScrapingTabId = scrapingTabId; // Restore runtime variable
      console.log(
        "[Background] Restored activeScrapingTabId from storage:",
        scrapingTabId,
      );
    }
  }

  if (!scrapingTabId) return;

  // Verify the scraping tab still exists - if not, clear stale state
  try {
    await chrome.tabs.get(scrapingTabId);
  } catch {
    // Tab no longer exists - clear stale state
    console.log("[Background] Scraping tab no longer exists, clearing stale state");
    activeScrapingTabId = null;
    await clearScrapingState();
    return;
  }

  if (activeInfo.tabId !== scrapingTabId) {
    // Pause scraping when leaving the TikTok tab (for both single and batch scraping)
    console.log("[Background] Scraping tab lost focus, pausing");
    chrome.tabs.sendMessage(scrapingTabId, { type: MessageType.SCRAPE_PAUSE });
    await saveScrapingState({
      isPaused: true,
      status: "paused",
      message: "Paused - TikTok tab must be active",
    });
    broadcastScrapingState();
  } else {
    console.log("[Background] Scraping tab regained focus, resuming");
    chrome.tabs.sendMessage(scrapingTabId, { type: MessageType.SCRAPE_RESUME });
    await saveScrapingState({
      isPaused: false,
      status: "scraping",
      message: "Scraping comments...",
    });
    broadcastScrapingState();
  }
});

async function broadcastScrapingState(): Promise<void> {
  const state = await getScrapingState();
  const message: ExtensionMessage = {
    type: MessageType.SCRAPE_PAUSED,
    payload: state,
  };
  broadcastToDashboard(message);
  broadcastToPopup(message);
}

async function broadcastToPopup(message: ExtensionMessage): Promise<void> {
  try {
    const views = chrome.extension.getViews({ type: "popup" });
    // Extension views receive messages via runtime.sendMessage
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup may not be open
    });
  } catch {
    // Ignore errors
  }
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true;
  },
);

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
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  console.log("[Background] Message received:", message.type);

  switch (message.type) {
    case MessageType.GET_SCRAPED_COMMENTS: {
      const comments = await getScrapedComments();
      return { comments };
    }

    case MessageType.REMOVE_SCRAPED_COMMENT: {
      const { commentId } = message.payload as { commentId: string };
      await removeScrapedComment(commentId);
      return { success: true };
    }

    case MessageType.REMOVE_SCRAPED_COMMENTS: {
      const { commentIds } = message.payload as { commentIds: string[] };
      await removeScrapedComments(commentIds);
      return { success: true };
    }

    case MessageType.UPDATE_SCRAPED_COMMENT: {
      const { commentId, updates } = message.payload as {
        commentId: string;
        updates: Partial<ScrapedComment>;
      };
      await updateScrapedComment(commentId, updates);
      return { success: true };
    }

    case MessageType.OPEN_TIKTOK_TAB: {
      const tab = await chrome.tabs.create({
        url: "https://www.tiktok.com",
        active: true,
        index: await getDashboardTabIndex(),
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

    case MessageType.GET_SCRAPING_STATE: {
      const state = await getScrapingState();
      return { state };
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

    case MessageType.GET_IGNORE_LIST: {
      const ignoreList = await getIgnoreList();
      return { ignoreList };
    }

    case MessageType.ADD_TO_IGNORE_LIST: {
      const { text } = message.payload as { text: string };
      await addToIgnoreList(text);
      return { success: true };
    }

    case MessageType.REMOVE_FROM_IGNORE_LIST: {
      const { text } = message.payload as { text: string };
      await removeFromIgnoreList(text);
      return { success: true };
    }

    // Forward video scraping messages from content script to dashboard
    case MessageType.SCRAPE_VIDEOS_PROGRESS:
    case MessageType.SCRAPE_VIDEOS_ERROR: {
      broadcastToDashboard(message);
      return { success: true };
    }

    case MessageType.SCRAPE_VIDEOS_COMPLETE: {
      const { videos, limitReached } = message.payload as {
        videos: ScrapedVideo[];
        limitReached?: boolean;
      };
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
      const { comments } = message.payload as { comments: ScrapedComment[] };
      // Capture batch state BEFORE async ops - the responseHandler in scrapeVideoComments
      // resolves synchronously, which can set isBatchScraping=false before we finish here
      const wasBatchScraping = isBatchScraping;
      await addScrapedComments(comments);
      const videoId = comments[0]?.videoId;
      if (videoId) {
        await updateVideo(videoId, { commentsScraped: true });
      }
      // Only broadcast to dashboard if NOT in batch scraping mode
      // During batch scraping, GET_BATCH_COMMENTS_COMPLETE will send cumulative stats
      if (!wasBatchScraping) {
        broadcastToDashboard(message);
      }
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

    // Handle cancel from popup/dashboard via regular messaging
    case MessageType.SCRAPE_VIDEO_COMMENTS_STOP: {
      console.log(
        "[Background] Received SCRAPE_VIDEO_COMMENTS_STOP via sendMessage, cancelling batch",
      );
      batchCancelled = true;
      if (activeScrapingTabId) {
        chrome.tabs.sendMessage(activeScrapingTabId, {
          type: MessageType.SCRAPE_VIDEO_COMMENTS_STOP,
        });
      }
      // Broadcast cancellation confirmation to dashboard for immediate UI update
      broadcastToDashboard({
        type: MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE,
        payload: { comments: [], cancelled: true },
      });
      return { success: true };
    }

    // Storage updates - broadcast to dashboard for real-time UI updates
    case MessageType.COMMENTS_UPDATED: {
      broadcastToDashboard(message);
      return { success: true };
    }

    // Rate limit handling
    case MessageType.GET_RATE_LIMIT_STATE: {
      const state = await getRateLimitState();
      return { state };
    }

    case MessageType.CLEAR_RATE_LIMIT: {
      await clearRateLimitState();
      updateRateLimitBadge(false);
      return { success: true };
    }

    case MessageType.AUTH_TOKEN_RESPONSE: {
      const { token } = message.payload as { token: string | null };
      if (token) {
        await setAuthToken(token);
        console.log("[Background] Auth token stored from web app");
        // Notify popup about the new token
        broadcastToPopup(message);
      }
      return { success: true };
    }

    case MessageType.GET_AUTH_TOKEN: {
      // Request token from dashboard - forward to dashboard tabs
      const tabs = await chrome.tabs.query({ url: "http://localhost:3000/*" });
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs
            .sendMessage(tab.id, { type: MessageType.GET_AUTH_TOKEN })
            .catch(() => {
              // Dashboard may not have content script ready
            });
        }
      }
      return { requested: true };
    }

    case MessageType.OPEN_DASHBOARD_TAB: {
      const tabs = await chrome.tabs.query({ url: "http://localhost:3000/*" });
      if (tabs.length > 0 && tabs[0].id) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        if (tabs[0].windowId) {
          await chrome.windows.update(tabs[0].windowId, { focused: true });
        }
      } else {
        await chrome.tabs.create({
          url: "http://localhost:3000",
          active: true,
        });
      }
      return { success: true };
    }

    case MessageType.CHECK_EXTENSION: {
      return { installed: true };
    }

    default:
      console.log("[Background] Unknown message type:", message.type);
      return null;
  }
}

async function handlePortMessage(
  message: ExtensionMessage,
  port: chrome.runtime.Port,
): Promise<void> {
  console.log("[Background] Port message:", message.type);

  switch (message.type) {
    case MessageType.REPLY_COMMENT: {
      const { comment, message: replyContent } = message.payload as {
        comment: ScrapedComment;
        message: string;
      };
      await handleReplyToComment(comment, replyContent, port);
      break;
    }

    case MessageType.BULK_REPLY_START: {
      const { commentIds, messages: replyMessages } = message.payload as {
        commentIds: string[];
        messages: string[];
      };
      await handleBulkReply(commentIds, replyMessages, port);
      break;
    }

    case MessageType.BULK_REPLY_STOP: {
      break;
    }

    case MessageType.SCRAPE_VIDEO_COMMENTS_STOP: {
      console.log(
        "[Background] Received SCRAPE_VIDEO_COMMENTS_STOP, cancelling",
      );
      batchCancelled = true;
      // Cancel the current video's scraping - the batch loop will handle cleanup
      if (activeScrapingTabId) {
        chrome.tabs.sendMessage(activeScrapingTabId, {
          type: MessageType.SCRAPE_VIDEO_COMMENTS_STOP,
        });
      }
      // Broadcast cancellation confirmation to dashboard for immediate UI update
      broadcastToDashboard({
        type: MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE,
        payload: { comments: [], cancelled: true },
      });
      break;
    }

    case MessageType.SCRAPE_VIDEOS_START: {
      try {
        const payload = message.payload as
          | { profileHandle?: string; postLimit?: number }
          | undefined;
        const handle = payload?.profileHandle || (await getAccountHandle());

        if (!handle) {
          port.postMessage({
            type: MessageType.SCRAPE_VIDEOS_ERROR,
            payload: {
              error: "No profile handle set. Please enter a TikTok handle.",
            },
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

        const postLimit = payload?.postLimit ?? (await getPostLimit());
        const messageWithLimit = {
          ...message,
          payload: { ...payload, postLimit },
        };

        await forwardToContentScript(tiktokTab.id, messageWithLimit, port);
      } catch (error) {
        port.postMessage({
          type: MessageType.SCRAPE_VIDEOS_ERROR,
          payload: {
            error:
              error instanceof Error
                ? error.message
                : "Failed to start scraping",
          },
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
        chrome.tabs.sendMessage(tabs[0].id, {
          type: MessageType.SCRAPE_VIDEOS_STOP,
        });
      }
      break;
    }

    case MessageType.GET_VIDEO_COMMENTS: {
      const { videoId } = message.payload as { videoId: string };
      await handleGetVideoComments(videoId, port);
      break;
    }

    case MessageType.GET_BATCH_COMMENTS: {
      const { videoIds } = message.payload as { videoIds: string[] };
      await handleGetBatchComments(videoIds, port);
      break;
    }

    default:
      console.log("[Background] Unknown port message:", message.type);
  }
}

async function findOrCreateTikTokTab(
  handle?: string,
): Promise<chrome.tabs.Tab | null> {
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
    index: await getDashboardTabIndex(),
  });

  if (tab.id) {
    await waitForTabLoad(tab.id);
  }

  return tab;
}

async function forwardToContentScript(
  tabId: number,
  message: ExtensionMessage,
  responsePort: chrome.runtime.Port,
): Promise<void> {
  const maxRetries = 20;
  const retryDelay = 2000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      return;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(
        `[Background] Content script not ready, attempt ${attempt + 1}/${maxRetries}`,
      );

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
  // Send via port connection if available
  let sentViaPort = false;
  activePorts.forEach((port) => {
    if (port.name === "dashboard") {
      port.postMessage(message);
      sentViaPort = true;
    }
  });

  // Only use tabs API as backup if port wasn't available
  if (!sentViaPort) {
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
}

async function handleReplyToComment(
  comment: ScrapedComment,
  replyContent: string,
  port: chrome.runtime.Port,
): Promise<void> {
  try {
    if (!comment.videoUrl) {
      throw new Error("No video URL available for this comment");
    }

    port.postMessage({
      type: MessageType.REPLY_COMMENT_PROGRESS,
      payload: {
        commentId: comment.id,
        status: "navigating",
        message: "Opening video...",
      },
    });

    const tab = await chrome.tabs.create({
      url: comment.videoUrl,
      active: false,
      index: await getDashboardTabIndex(),
    });

    if (!tab.id) throw new Error("Failed to create tab");

    await waitForTabLoad(tab.id);

    chrome.tabs.sendMessage(tab.id, {
      type: MessageType.REPLY_COMMENT,
      payload: { comment, message: replyContent },
    });
  } catch (error) {
    port.postMessage({
      type: MessageType.REPLY_COMMENT_ERROR,
      payload: {
        commentId: comment.id,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

async function handleBulkReply(
  commentIds: string[],
  replyMessages: string[],
  port: chrome.runtime.Port,
): Promise<void> {
  const comments = await getScrapedComments();
  const settings = await getSettings();

  const targetComments = comments.filter(
    (c) => commentIds.includes(c.id) && !c.replySent && c.videoUrl,
  );

  const progress: BulkReplyProgress = {
    total: targetComments.length,
    completed: 0,
    failed: 0,
    status: "running",
  };

  for (let i = 0; i < targetComments.length; i++) {
    const comment = targetComments[i];
    const replyMessage = replyMessages[i % replyMessages.length];

    progress.current = comment.handle;
    port.postMessage({
      type: MessageType.BULK_REPLY_PROGRESS,
      payload: progress,
    });

    try {
      await handleReplyToComment(comment, replyMessage, port);
      progress.completed++;

      await updateScrapedComment(comment.id, {
        replySent: true,
        repliedAt: new Date().toISOString(),
      });

      await new Promise((resolve) =>
        setTimeout(resolve, settings.messageDelay),
      );
    } catch {
      progress.failed++;
      await updateScrapedComment(comment.id, {
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
  port: chrome.runtime.Port,
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
      active: true,
      index: await getDashboardTabIndex(),
    });

    if (!tab.id) {
      throw new Error("Failed to create tab");
    }

    // Mute immediately before video can start playing
    chrome.tabs.update(tab.id, { muted: true });

    activeScrapingTabId = tab.id;
    isBatchScraping = false;
    await saveScrapingState({
      isActive: true,
      isPaused: false,
      videoId,
      tabId: tab.id,
      commentsFound: 0,
      status: "loading",
      message: "Opening video...",
    });
    broadcastScrapingState();

    updateBadge("...", colors.status.info);

    await waitForTabLoad(tab.id);

    await saveScrapingState({
      status: "scraping",
      message: "Scraping comments...",
    });
    broadcastScrapingState();

    port.postMessage({
      type: MessageType.GET_VIDEO_COMMENTS_PROGRESS,
      payload: { videoId, status: "scraping", message: "Scraping comments..." },
    });

    const commentLimit = await getCommentLimit();

    const cleanupScraping = async () => {
      activeScrapingTabId = null;
      await clearScrapingState();
      broadcastScrapingState();
      clearBadge();
    };

    const responseHandler = async (msg: ExtensionMessage) => {
      console.log(
        "[Background] Response handler received:",
        msg.type,
        msg.payload,
      );
      if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS) {
        const payload = msg.payload as {
          commentsFound?: number;
          message?: string;
        };
        const count = payload.commentsFound || 0;
        console.log("[Background] Progress update, commentsFound:", count);
        await saveScrapingState({
          commentsFound: count,
          message: payload.message || "Scraping...",
        });
        broadcastScrapingState();
        updateBadge(count.toString(), colors.status.info);
        const progressPayload = (msg.payload || {}) as Record<string, unknown>;
        port.postMessage({
          type: MessageType.GET_VIDEO_COMMENTS_PROGRESS,
          payload: { videoId, ...progressPayload },
        });
      } else if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE) {
        console.log("[Background] Scrape complete, payload:", msg.payload);
        const { comments: scrapedComments } = msg.payload as {
          comments: ScrapedComment[];
        };
        console.log(
          "[Background] Comments received:",
          scrapedComments?.length || 0,
          "comments array:",
          !!scrapedComments,
        );
        if (scrapedComments && scrapedComments.length > 0) {
          addScrapedComments(scrapedComments);
        }
        updateVideo(videoId, { commentsScraped: true });
        port.postMessage({
          type: MessageType.GET_VIDEO_COMMENTS_COMPLETE,
          payload: { videoId, commentCount: scrapedComments?.length || 0 },
        });
        chrome.runtime.onMessage.removeListener(responseHandler);
        await cleanupScraping();
        closingTabsIntentionally.add(tab.id!);
        chrome.tabs.remove(tab.id!);
        await focusDashboardTab();
      } else if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_ERROR) {
        console.log("[Background] Scrape error:", msg.payload);
        const errorPayload = (msg.payload || {}) as Record<string, unknown>;
        port.postMessage({
          type: MessageType.GET_VIDEO_COMMENTS_ERROR,
          payload: { videoId, ...errorPayload },
        });
        chrome.runtime.onMessage.removeListener(responseHandler);
        await cleanupScraping();
        closingTabsIntentionally.add(tab.id!);
        chrome.tabs.remove(tab.id!);
        await focusDashboardTab();
      }
    };

    chrome.runtime.onMessage.addListener(responseHandler);

    chrome.tabs.sendMessage(tab.id, {
      type: MessageType.SCRAPE_VIDEO_COMMENTS_START,
      payload: { maxComments: commentLimit },
    });
  } catch (error) {
    activeScrapingTabId = null;
    await clearScrapingState();
    broadcastScrapingState();
    clearBadge();
    port.postMessage({
      type: MessageType.GET_VIDEO_COMMENTS_ERROR,
      payload: {
        videoId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}

async function handleGetBatchComments(
  videoIds: string[],
  port: chrome.runtime.Port,
): Promise<void> {
  if (videoIds.length === 0) return;

  const videos = await getVideos();
  const videosToProcess = videoIds
    .map((id) => videos.find((v) => v.videoId === id))
    .filter((v): v is NonNullable<typeof v> => v !== undefined);

  if (videosToProcess.length === 0) {
    port.postMessage({
      type: MessageType.GET_BATCH_COMMENTS_ERROR,
      payload: { error: "No valid videos found" },
    });
    return;
  }

  // Reset cancellation flag at start of batch
  batchCancelled = false;

  let totalComments = 0;
  let completedVideos = 0;
  let tab: chrome.tabs.Tab | null = null;

  // Cumulative stats across all videos
  const cumulativeStats = { found: 0, stored: 0, duplicates: 0, ignored: 0 };

  // Get the total comment limit for the entire batch
  const totalCommentLimit = await getCommentLimit();
  console.log(
    `[Background] Starting batch scrape: ${videosToProcess.length} videos, limit: ${totalCommentLimit} comments total`,
  );

  const sendProgress = (
    currentVideoIndex: number,
    currentVideoId: string | null,
    message: string,
  ) => {
    port.postMessage({
      type: MessageType.GET_BATCH_COMMENTS_PROGRESS,
      payload: {
        totalVideos: videosToProcess.length,
        completedVideos,
        currentVideoIndex,
        currentVideoId,
        totalComments,
        status: "processing",
        message,
      },
    });
    updateBadge(`${currentVideoIndex}/${videosToProcess.length}`, colors.status.info);
  };

  try {
    for (let i = 0; i < videosToProcess.length; i++) {
      // Check if batch was cancelled
      if (batchCancelled) {
        console.log("[Background] Batch cancelled, stopping loop");
        break;
      }

      const video = videosToProcess[i];

      // Calculate remaining comment budget for this video
      const remainingBudget = totalCommentLimit - totalComments;
      if (remainingBudget <= 0) {
        console.log(
          `[Background] Comment limit reached (${totalComments}/${totalCommentLimit}), stopping batch`,
        );
        break;
      }

      sendProgress(
        i + 1,
        video.videoId,
        `Processing video ${i + 1} of ${videosToProcess.length}...`,
      );

      if (i === 0) {
        tab = await chrome.tabs.create({
          url: video.videoUrl,
          active: true,
          index: await getDashboardTabIndex(),
        });
        if (!tab?.id) throw new Error("Failed to create tab");
        chrome.tabs.update(tab.id, { muted: true });
        activeScrapingTabId = tab.id;
        isBatchScraping = true;
      } else if (tab?.id) {
        await chrome.tabs.update(tab.id, { url: video.videoUrl, active: true });
      }

      await saveScrapingState({
        isActive: true,
        isPaused: false,
        videoId: video.videoId,
        tabId: tab?.id || null,
        commentsFound: 0,
        status: "loading",
        message: `Loading video ${i + 1} of ${videosToProcess.length}...`,
      });

      await waitForTabLoad(tab!.id!);

      const videoIndex = i + 1;
      console.log(
        `[Background] Scraping video ${videoIndex}, remaining budget: ${remainingBudget}`,
      );
      const result = await scrapeVideoComments(
        tab!.id!,
        video.videoId,
        remainingBudget,
        (videoId, message) => {
          sendProgress(videoIndex, videoId, message);
        },
      );

      totalComments += result.commentCount;
      cumulativeStats.found += result.stats.found;
      cumulativeStats.stored += result.stats.stored;
      cumulativeStats.duplicates += result.stats.duplicates;
      cumulativeStats.ignored += result.stats.ignored;
      completedVideos++;
      await updateVideo(video.videoId, { commentsScraped: true });

      sendProgress(
        i + 1,
        video.videoId,
        `Completed video ${i + 1} of ${videosToProcess.length}`,
      );

      // Check again after scraping in case it was cancelled during scrape
      console.log(
        `[Background] After video ${i + 1}: batchCancelled=${batchCancelled}, totalComments=${totalComments}`,
      );
      if (batchCancelled) {
        console.log(
          "[Background] Batch cancelled after video scrape, breaking loop",
        );
        break;
      }
    }

    activeScrapingTabId = null;
    isBatchScraping = false;
    await clearScrapingState();
    clearBadge();

    const wasCancelled = batchCancelled;
    batchCancelled = false; // Reset for next batch

    if (wasCancelled) {
      port.postMessage({
        type: MessageType.GET_BATCH_COMMENTS_ERROR,
        payload: {
          error: "Batch scraping cancelled",
          completedVideos,
          totalComments,
        },
      });
    } else {
      port.postMessage({
        type: MessageType.GET_BATCH_COMMENTS_COMPLETE,
        payload: {
          totalVideos: videosToProcess.length,
          totalComments,
          videoIds: videosToProcess.map((v) => v.videoId),
          stats: cumulativeStats,
        },
      });
    }

    if (tab?.id) {
      closingTabsIntentionally.add(tab.id);
      chrome.tabs.remove(tab.id);
    }
    await focusDashboardTab();
  } catch (error) {
    activeScrapingTabId = null;
    isBatchScraping = false;
    batchCancelled = false;
    await clearScrapingState();
    clearBadge();

    port.postMessage({
      type: MessageType.GET_BATCH_COMMENTS_ERROR,
      payload: {
        error: error instanceof Error ? error.message : "Unknown error",
        completedVideos,
        totalComments,
      },
    });

    if (tab?.id) {
      closingTabsIntentionally.add(tab.id);
      chrome.tabs.remove(tab.id).catch(() => {});
    }
    await focusDashboardTab();
  }
}

interface VideoScrapeResult {
  commentCount: number;
  stats: { found: number; stored: number; duplicates: number; ignored: number };
}

async function scrapeVideoComments(
  tabId: number,
  videoId: string,
  commentLimit: number,
  onProgress: (videoId: string, message: string) => void,
): Promise<VideoScrapeResult> {
  console.log(
    "[Background] scrapeVideoComments called for tabId:",
    tabId,
    "videoId:",
    videoId,
    "limit:",
    commentLimit,
  );
  return new Promise((resolve, reject) => {
    const responseHandler = (msg: ExtensionMessage) => {
      console.log("[Background] Batch scrape handler received:", msg.type);
      if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS) {
        const payload = msg.payload as {
          commentsFound?: number;
          message?: string;
        };
        onProgress(
          videoId,
          payload.message || `Found ${payload.commentsFound || 0} comments...`,
        );
      } else if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE) {
        const { comments, stats } = msg.payload as {
          comments: ScrapedComment[];
          stats?: {
            found: number;
            stored: number;
            duplicates: number;
            ignored: number;
          };
        };
        console.log(
          "[Background] Batch scrape complete, comments:",
          comments?.length || 0,
          "stats:",
          stats,
        );
        chrome.runtime.onMessage.removeListener(responseHandler);
        resolve({
          commentCount: comments?.length || 0,
          stats: stats || { found: 0, stored: 0, duplicates: 0, ignored: 0 },
        });
      } else if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_ERROR) {
        console.log("[Background] Batch scrape error:", msg.payload);
        chrome.runtime.onMessage.removeListener(responseHandler);
        reject(
          new Error(
            (msg.payload as { error?: string })?.error || "Scraping failed",
          ),
        );
      }
    };

    chrome.runtime.onMessage.addListener(responseHandler);

    console.log(
      "[Background] Sending SCRAPE_VIDEO_COMMENTS_START to tab:",
      tabId,
    );
    chrome.tabs.sendMessage(tabId, {
      type: MessageType.SCRAPE_VIDEO_COMMENTS_START,
      payload: { maxComments: commentLimit },
    });
  });
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout"));
    }, 60000);

    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
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

// Rate limit detection via webRequest
const TIKTOK_COMMENT_API_PATTERNS = [
  "*://www.tiktok.com/api/comment/*",
  "*://www.tiktok.com/api/comment/list/*",
];

function updateRateLimitBadge(isRateLimited: boolean): void {
  if (isRateLimited) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: colors.status.error });
  } else {
    // Only clear if we're not actively scraping
    if (!activeScrapingTabId) {
      clearBadge();
    }
  }
}

let rateLimitResumeTimeout: ReturnType<typeof setTimeout> | null = null;

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    const is429 = details.statusCode === 429;
    const is5xx = details.statusCode >= 500 && details.statusCode < 600;

    if (is429 || is5xx) {
      const errorMsg = `TikTok API error ${details.statusCode} on ${new URL(details.url).pathname}`;
      console.log(`[Background] Rate limit detected: ${errorMsg}`);

      // For 429 errors during active scraping, pause and set resume time
      const shouldPause = is429 && activeScrapingTabId;
      const resumeAt = shouldPause ? new Date(Date.now() + 60000).toISOString() : null;

      const state = await recordRateLimitError(errorMsg, {
        isPausedFor429: shouldPause,
        resumeAt,
      });
      updateRateLimitBadge(true);

      // Broadcast to popup/dashboard
      broadcastToDashboard({
        type: MessageType.RATE_LIMIT_DETECTED,
        payload: state,
      });
      broadcastToPopup({
        type: MessageType.RATE_LIMIT_DETECTED,
        payload: state,
      });

      // For 429 errors, pause scraping and auto-resume after 60 seconds
      if (shouldPause) {
        console.log(`[Background] 429 detected - pausing scraping for 60 seconds`);
        chrome.tabs.sendMessage(activeScrapingTabId!, { type: MessageType.SCRAPE_PAUSE });

        // Clear any existing resume timeout
        if (rateLimitResumeTimeout) {
          clearTimeout(rateLimitResumeTimeout);
        }

        // Auto-resume after 60 seconds
        rateLimitResumeTimeout = setTimeout(async () => {
          console.log(`[Background] 60 seconds elapsed - resuming scraping`);
          if (activeScrapingTabId) {
            chrome.tabs.sendMessage(activeScrapingTabId, { type: MessageType.SCRAPE_RESUME });
          }
          await clearRateLimitState();
          updateRateLimitBadge(false);
          broadcastToDashboard({ type: MessageType.RATE_LIMIT_CLEARED });
          broadcastToPopup({ type: MessageType.RATE_LIMIT_CLEARED });
          rateLimitResumeTimeout = null;
        }, 60000);
      }
    }
  },
  { urls: TIKTOK_COMMENT_API_PATTERNS },
);

// Check rate limit state on startup and update badge
getRateLimitState().then((state) => {
  if (state.isRateLimited) {
    // Check if the last error was within the last 5 minutes
    const lastErrorTime = state.lastErrorAt
      ? new Date(state.lastErrorAt).getTime()
      : 0;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (lastErrorTime > fiveMinutesAgo) {
      updateRateLimitBadge(true);
    } else {
      // Clear stale rate limit state
      clearRateLimitState();
    }
  }
});

// Restore runtime state from storage on service worker start
getScrapingState().then((state) => {
  if (state.isActive && state.tabId) {
    activeScrapingTabId = state.tabId;
    isBatchScraping = false; // Conservative - assume single video scrape
    console.log(
      "[Background] Restored scraping state on startup, tabId:",
      state.tabId,
    );
  }
});

console.log("[Background] Tokative service worker initialized");
