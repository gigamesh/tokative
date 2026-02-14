import { initSentry } from "../utils/sentry";
initSentry("background");

import { colors, ScrapeStats } from "@tokative/shared";
import { getLoadedConfig, loadConfig, refreshConfig } from "../config/loader";
import {
  BulkReplyProgress,
  ExtensionMessage,
  MessageType,
  ScrapedComment,
  ScrapedVideo,
} from "../types";
import { setAuthToken } from "../utils/convex-api";
import { TabError } from "../utils/errors";
import { logger } from "../utils/logger";
import {
  addToIgnoreList,
  addVideos,
  clearRateLimitState,
  clearScrapingState,
  getAccountHandle,
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
  savePostLimit,
  saveScrapingState,
  updateScrapedComment,
  updateVideo,
} from "../utils/storage";

declare const TOKATIVE_ENDPOINT_PLACEHOLDER: string;
const TOKATIVE_ENDPOINT = TOKATIVE_ENDPOINT_PLACEHOLDER;
const TOKATIVE_ENDPOINT_PATTERN = TOKATIVE_ENDPOINT + "/*";

const activePorts = new Map<string, chrome.runtime.Port>();
let activeScrapingTabId: number | null = null;
let isApiScraping = false;
let isBatchScraping = false;
let batchCancelled = false;
const closingTabsIntentionally = new Set<number>();
let lastScrapingVideoId: string | null = null;
let lastScrapingStats: ScrapeStats | null = null;
let lastBatchProgress: {
  completedVideos: number;
  totalComments: number;
} | null = null;

// Message types that should be forwarded directly to dashboard
const FORWARD_TO_DASHBOARD_MESSAGES: Set<MessageType> = new Set([
  MessageType.SCRAPE_VIDEOS_PROGRESS,
  MessageType.SCRAPE_VIDEOS_ERROR,
  MessageType.GET_VIDEO_COMMENTS_PROGRESS,
  MessageType.GET_VIDEO_COMMENTS_COMPLETE,
  MessageType.GET_VIDEO_COMMENTS_ERROR,
  MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS,
  MessageType.SCRAPE_VIDEO_COMMENTS_ERROR,
  MessageType.REPLY_COMMENT_PROGRESS,
  MessageType.REPLY_COMMENT_COMPLETE,
  MessageType.REPLY_COMMENT_ERROR,
  MessageType.COMMENTS_UPDATED,
]);

async function cleanupScrapingSession(): Promise<void> {
  activeScrapingTabId = null;
  isApiScraping = false;
  isBatchScraping = false;
  lastScrapingVideoId = null;
  lastScrapingStats = null;
  lastBatchProgress = null;
  await clearScrapingState();
  broadcastScrapingState();
  clearBadge();
}

async function updateAndBroadcastScrapingState(
  state: Partial<Parameters<typeof saveScrapingState>[0]>,
): Promise<void> {
  await saveScrapingState(state);
  broadcastScrapingState();
}

async function getDashboardTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const tabs = await chrome.tabs.query({ url: TOKATIVE_ENDPOINT_PATTERN });
    return tabs.length > 0 && tabs[0].id ? tabs[0] : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

async function getDashboardTabIndex(): Promise<number | undefined> {
  try {
    const tabs = await chrome.tabs.query({ url: TOKATIVE_ENDPOINT_PATTERN });
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
    const tab = await getDashboardTab();
    if (tab?.id) {
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
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
    logger.log("[Background] Scraping tab was closed by user");
    const wasBatchScraping = isBatchScraping;
    const savedVideoId = lastScrapingVideoId;
    const savedStats = lastScrapingStats;
    const savedBatch = lastBatchProgress;
    await cleanupScrapingSession();

    if (wasBatchScraping) {
      broadcastToDashboard({
        type: MessageType.GET_BATCH_COMMENTS_ERROR,
        payload: {
          error: "Collecting cancelled - TikTok tab was closed",
          completedVideos: savedBatch?.completedVideos ?? 0,
          totalComments: savedBatch?.totalComments ?? 0,
        },
      });
    } else {
      broadcastToDashboard({
        type: MessageType.GET_VIDEO_COMMENTS_ERROR,
        payload: {
          error: "Collecting cancelled - TikTok tab was closed",
          videoId: savedVideoId,
          stats: savedStats,
        },
      });
    }
  }
});

chrome.tabs.onActivated.addListener(async () => {
  if (isApiScraping) return;

  let scrapingTabId = activeScrapingTabId;

  if (!scrapingTabId) {
    const state = await getScrapingState();
    if (state.isActive && state.tabId) {
      scrapingTabId = state.tabId;
      activeScrapingTabId = scrapingTabId;
    }
  }

  if (!scrapingTabId) return;

  try {
    await chrome.tabs.get(scrapingTabId);
  } catch {
    logger.log(
      "[Background] Scraping tab no longer exists, clearing stale state",
    );
    activeScrapingTabId = null;
    await clearScrapingState();
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
  activePorts.set(port.name, port);

  if (port.name === "dashboard") {
    port.postMessage({ type: "PORT_READY" });
  }

  port.onMessage.addListener((message: ExtensionMessage) => {
    handlePortMessage(message, port);
  });

  port.onDisconnect.addListener(() => {
    activePorts.delete(port.name);
  });
});

export async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  // Handle simple message forwarding to dashboard
  if (FORWARD_TO_DASHBOARD_MESSAGES.has(message.type)) {
    if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS) {
      const payload = message.payload as { stats?: ScrapeStats };
      if (payload.stats) lastScrapingStats = payload.stats;
    }
    broadcastToDashboard(message);
    return { success: true };
  }

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

    case MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE: {
      const { comments } = message.payload as { comments: ScrapedComment[] };
      // Capture batch state BEFORE async ops - the responseHandler in scrapeVideoComments
      // resolves synchronously, which can set isBatchScraping=false before we finish here
      const wasBatchScraping = isBatchScraping;
      // NOTE: Content script already saves incrementally during scraping, so we don't
      // call addScrapedComments here to avoid duplicate storage attempts
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

    // Handle cancel from popup/dashboard via regular messaging
    case MessageType.SCRAPE_VIDEO_COMMENTS_STOP: {
      logger.log(
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
        logger.log("[Background] Auth token stored from web app");
        // Notify popup about the new token
        broadcastToPopup(message);
      }
      return { success: true };
    }

    case MessageType.GET_AUTH_TOKEN: {
      // Request token from dashboard - forward to dashboard tabs
      const tabs = await chrome.tabs.query({ url: TOKATIVE_ENDPOINT_PATTERN });
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
      const tab = await getDashboardTab();
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
      } else {
        await chrome.tabs.create({
          url: TOKATIVE_ENDPOINT,
          active: true,
        });
      }
      return { success: true };
    }

    case MessageType.CHECK_EXTENSION: {
      return { installed: true };
    }

    case MessageType.ACTIVATE_TAB: {
      const tabId = sender.tab?.id;
      if (tabId) {
        await chrome.tabs.update(tabId, { active: true });
        if (sender.tab?.windowId) {
          await chrome.windows.update(sender.tab.windowId, { focused: true });
        }
      }
      return { success: true };
    }

    case MessageType.GET_CONFIG: {
      const config = getLoadedConfig();
      return { config };
    }

    case MessageType.REFRESH_CONFIG: {
      const config = await refreshConfig();
      return { config };
    }

    default:
      return null;
  }
}

async function handlePortMessage(
  message: ExtensionMessage,
  port: chrome.runtime.Port,
): Promise<void> {
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
      const {
        comments: incomingComments,
        messages: replyMessages,
        deleteMissingComments,
      } = message.payload as {
        comments: ScrapedComment[];
        messages: string[];
        deleteMissingComments: boolean;
      };
      await handleBulkReply(
        incomingComments,
        replyMessages,
        deleteMissingComments,
        port,
      );
      break;
    }

    case MessageType.BULK_REPLY_STOP: {
      break;
    }

    case MessageType.SCRAPE_VIDEO_COMMENTS_STOP: {
      logger.log(
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
          payload: { error: getErrorMessage(error) },
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
      break;
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
  const config = getLoadedConfig();
  const maxRetries = config.limits.contentScriptRetries;
  const retryDelay = config.limits.contentScriptRetryDelay;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      return;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.log(
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
      const tabs = await chrome.tabs.query({ url: TOKATIVE_ENDPOINT_PATTERN });
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

interface ReplyToCommentResult {
  success: boolean;
  error?: string;
  tabId?: number;
}

async function handleReplyToComment(
  comment: ScrapedComment,
  replyContent: string,
  port: chrome.runtime.Port,
  existingTabId?: number,
): Promise<ReplyToCommentResult> {
  let tabId: number | undefined;
  let tabCreatedHere = false;

  try {
    if (!comment.videoUrl) {
      throw new TabError(
        "NO_VIDEO_URL",
        "No video URL available for this comment",
      );
    }

    port.postMessage({
      type: MessageType.REPLY_COMMENT_PROGRESS,
      payload: {
        commentId: comment.id,
        status: "navigating",
        message: "Opening video...",
      },
    });

    if (existingTabId) {
      await chrome.tabs.update(existingTabId, {
        url: comment.videoUrl,
        muted: true,
      });
      tabId = existingTabId;
      await waitForTabLoad(tabId);
    } else {
      const tab = await chrome.tabs.create({
        url: comment.videoUrl,
        active: false,
        index: await getDashboardTabIndex(),
      });

      if (!tab.id)
        throw new TabError("TAB_CREATE_FAILED", "Failed to create tab");
      tabId = tab.id;
      tabCreatedHere = true;
      chrome.tabs.update(tabId, { muted: true });

      await waitForTabLoad(tabId);
    }

    const config = getLoadedConfig();
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(responseHandler);
        port.postMessage({
          type: MessageType.REPLY_COMMENT_ERROR,
          payload: {
            commentId: comment.id,
            error: `Reply timed out after ${config.timeouts.replyTimeout / 1000} seconds`,
          },
        });
        if (tabCreatedHere && tabId) {
          closingTabsIntentionally.add(tabId);
          chrome.tabs.remove(tabId).catch(() => {});
        }
        resolve({
          success: false,
          error: "Timeout",
          tabId: existingTabId ? tabId : undefined,
        });
      }, config.timeouts.replyTimeout);

      const responseHandler = (msg: ExtensionMessage) => {
        if (msg.type === MessageType.REPLY_COMMENT_COMPLETE) {
          const payload = msg.payload as { commentId?: string };
          if (payload.commentId === comment.id) {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(responseHandler);
            if (tabCreatedHere && tabId) {
              closingTabsIntentionally.add(tabId);
              chrome.tabs.remove(tabId).catch(() => {});
            }
            resolve({
              success: true,
              tabId: existingTabId ? tabId : undefined,
            });
          }
        } else if (msg.type === MessageType.REPLY_COMMENT_ERROR) {
          const payload = msg.payload as { commentId?: string; error?: string };
          if (payload.commentId === comment.id) {
            clearTimeout(timeout);
            chrome.runtime.onMessage.removeListener(responseHandler);
            if (tabCreatedHere && tabId) {
              closingTabsIntentionally.add(tabId);
              chrome.tabs.remove(tabId).catch(() => {});
            }
            resolve({
              success: false,
              error: payload.error,
              tabId: existingTabId ? tabId : undefined,
            });
          }
        }
      };

      chrome.runtime.onMessage.addListener(responseHandler);

      chrome.tabs.sendMessage(tabId!, {
        type: MessageType.REPLY_COMMENT,
        payload: { comment, message: replyContent },
      });
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    port.postMessage({
      type: MessageType.REPLY_COMMENT_ERROR,
      payload: {
        commentId: comment.id,
        error: errorMessage,
      },
    });
    if (tabCreatedHere && tabId) {
      closingTabsIntentionally.add(tabId);
      chrome.tabs.remove(tabId).catch(() => {});
    }
    return { success: false, error: errorMessage };
  }
}

function extractVideoIdFromUrl(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

async function handleBulkReply(
  comments: ScrapedComment[],
  replyMessages: string[],
  deleteMissingComments: boolean,
  port: chrome.runtime.Port,
): Promise<void> {
  const progress: BulkReplyProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    status: "running",
  };

  try {
    const targetComments = comments.filter((c) => !c.repliedTo && c.videoUrl);

    progress.total = targetComments.length;

    // Group comments by videoId for tab reuse
    const commentsByVideo = new Map<string, ScrapedComment[]>();
    for (const comment of targetComments) {
      const videoId =
        comment.videoId || extractVideoIdFromUrl(comment.videoUrl || "");
      if (videoId) {
        const existing = commentsByVideo.get(videoId) || [];
        existing.push(comment);
        commentsByVideo.set(videoId, existing);
      } else {
        // Fallback for comments without videoId - use videoUrl as key
        const key = comment.videoUrl || comment.id;
        const existing = commentsByVideo.get(key) || [];
        existing.push(comment);
        commentsByVideo.set(key, existing);
      }
    }

    // Fetch settings lazily — only needed for delay between multiple replies
    let messageDelay = 3000;
    if (targetComments.length > 1) {
      try {
        const settings = await getSettings();
        messageDelay = settings.messageDelay;
      } catch {
        // Use default delay if settings fetch fails
      }
    }

    let commentIndex = 0;

    // Process comments grouped by video
    for (const [videoKey, videoComments] of commentsByVideo) {
      let tabId: number | undefined;

      for (let i = 0; i < videoComments.length; i++) {
        const comment = videoComments[i];
        const replyMessage =
          comment.messageToSend ||
          replyMessages[commentIndex % replyMessages.length];
        commentIndex++;

        progress.current = comment.handle;
        port.postMessage({
          type: MessageType.BULK_REPLY_PROGRESS,
          payload: progress,
        });

        // Reuse tab for same video (pass existing tabId after first reply)
        const result = await handleReplyToComment(
          comment,
          replyMessage,
          port,
          tabId,
        );

        if (result.success) {
          progress.completed++;
          await updateScrapedComment(comment.id, {
            repliedTo: true,
            repliedAt: new Date().toISOString(),
          });
          // Store tabId for reuse on next comment in same video
          if (result.tabId) {
            tabId = result.tabId;
          }
        } else if (result.error === "Comment not found") {
          progress.skipped++;
          if (deleteMissingComments) {
            await removeScrapedComment(comment.id);
          } else {
            await updateScrapedComment(comment.id, {
              replyError: "Comment not found",
            });
          }
        } else {
          progress.failed++;
          await updateScrapedComment(comment.id, {
            replyError: result.error || "Failed to post reply",
          });
        }

        // Delay between replies
        if (i < videoComments.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, messageDelay));
        }
      }

      // Close tab after finishing all comments for this video
      if (tabId) {
        closingTabsIntentionally.add(tabId);
        chrome.tabs.remove(tabId).catch(() => {});
      }

      // Delay between videos
      if (commentsByVideo.size > 1) {
        await new Promise((resolve) => setTimeout(resolve, messageDelay));
      }
    }
  } catch (error) {
    progress.failed += Math.max(
      0,
      progress.total - progress.completed - progress.failed - progress.skipped,
    );
  } finally {
    progress.status = "complete";
    port.postMessage({
      type: MessageType.BULK_REPLY_COMPLETE,
      payload: progress,
    });
  }
}

async function handleGetVideoComments(
  videoId: string,
  port: chrome.runtime.Port,
): Promise<void> {
  await handleGetVideoCommentsViaApi(videoId, port);
}

async function handleGetVideoCommentsViaApi(
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
      active: false,
      index: await getDashboardTabIndex(),
    });

    if (!tab.id)
      throw new TabError("TAB_CREATE_FAILED", "Failed to create tab");
    chrome.tabs.update(tab.id, { muted: true });

    activeScrapingTabId = tab.id;
    isApiScraping = true;
    isBatchScraping = false;
    lastScrapingVideoId = videoId;
    lastScrapingStats = null;

    await updateAndBroadcastScrapingState({
      isActive: true,
      isPaused: false,
      videoId,
      tabId: tab.id,
      commentsFound: 0,
      status: "loading",
      message: "Opening video...",
    });
    updateBadge("...", colors.status.info);

    await waitForTabLoad(tab.id);

    await updateAndBroadcastScrapingState({
      status: "scraping",
      message: "Collecting comments...",
    });

    port.postMessage({
      type: MessageType.GET_VIDEO_COMMENTS_PROGRESS,
      payload: {
        videoId,
        status: "scraping",
        message: "Collecting comments...",
      },
    });

    return new Promise<void>((resolve) => {
      const responseHandler = async (msg: ExtensionMessage) => {
        if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS) {
          const payload = msg.payload as {
            commentsFound?: number;
            message?: string;
            stats?: ScrapeStats;
          };
          if (payload.stats) lastScrapingStats = payload.stats;
          const count = payload.commentsFound || 0;
          await updateAndBroadcastScrapingState({
            commentsFound: count,
            message: payload.message || "Collecting...",
          });
          updateBadge(count.toString(), colors.status.info);
          port.postMessage({
            type: MessageType.GET_VIDEO_COMMENTS_PROGRESS,
            payload: { videoId, ...payload },
          });
        } else if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE) {
          const { comments: scrapedComments } = msg.payload as {
            comments: ScrapedComment[];
          };
          updateVideo(videoId, { commentsScraped: true });
          port.postMessage({
            type: MessageType.GET_VIDEO_COMMENTS_COMPLETE,
            payload: { videoId, commentCount: scrapedComments?.length || 0 },
          });
          chrome.runtime.onMessage.removeListener(responseHandler);
          await cleanupScrapingSession();
          closingTabsIntentionally.add(tab.id!);
          chrome.tabs.remove(tab.id!);
          await focusDashboardTab();
          resolve();
        } else if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_ERROR) {
          const errorPayload = (msg.payload || {}) as Record<string, unknown>;
          port.postMessage({
            type: MessageType.GET_VIDEO_COMMENTS_ERROR,
            payload: { videoId, ...errorPayload, stats: lastScrapingStats },
          });
          chrome.runtime.onMessage.removeListener(responseHandler);
          await cleanupScrapingSession();
          closingTabsIntentionally.add(tab.id!);
          chrome.tabs.remove(tab.id!);
          await focusDashboardTab();
          resolve();
        }
      };

      chrome.runtime.onMessage.addListener(responseHandler);

      chrome.tabs.sendMessage(tab.id!, {
        type: MessageType.SCRAPE_VIDEO_COMMENTS_API_START,
      });
    });
  } catch (error) {
    await cleanupScrapingSession();
    port.postMessage({
      type: MessageType.GET_VIDEO_COMMENTS_ERROR,
      payload: { videoId, error: getErrorMessage(error) },
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
  let batchLimitReached = false;

  // Cumulative stats across all videos
  const cumulativeStats = { found: 0, new: 0, preexisting: 0, ignored: 0 };

  logger.log(
    `[Background] Starting batch scrape: ${videosToProcess.length} videos`,
  );

  const sendProgress = (
    currentVideoIndex: number,
    currentVideoId: string | null,
    message: string,
    stats?: ScrapeStats,
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
        currentVideoStats: stats,
      },
    });
    updateBadge(
      `${currentVideoIndex}/${videosToProcess.length}`,
      colors.status.info,
    );
  };

  try {
    for (let i = 0; i < videosToProcess.length; i++) {
      if (batchCancelled) {
        logger.log("[Background] Batch cancelled, stopping loop");
        break;
      }

      const video = videosToProcess[i];

      if (batchLimitReached) {
        logger.log("[Background] Monthly limit reached, stopping batch");
        break;
      }

      sendProgress(
        i + 1,
        video.videoId,
        `Collecting post ${i + 1} of ${videosToProcess.length}...`,
      );

      if (!tab) {
        tab = await chrome.tabs.create({
          url: video.videoUrl,
          active: false,
          index: await getDashboardTabIndex(),
        });
        if (!tab?.id)
          throw new TabError("TAB_CREATE_FAILED", "Failed to create tab");
        chrome.tabs.update(tab.id, { muted: true });
        activeScrapingTabId = tab.id;
        isApiScraping = true;
        isBatchScraping = true;
      } else if (tab.id) {
        await chrome.tabs.update(tab.id, { url: video.videoUrl });
      }

      await saveScrapingState({
        isActive: true,
        isPaused: false,
        videoId: video.videoId,
        tabId: tab?.id || null,
        commentsFound: 0,
        status: "loading",
        message: `Opening post ${i + 1} of ${videosToProcess.length}...`,
      });

      await waitForTabLoad(tab!.id!);

      const videoIndex = i + 1;

      const result = await scrapeVideoInTab(
        tab!.id!,
        video.videoId,
        (videoId, message, stats) => {
          sendProgress(videoIndex, videoId, message, stats);
        },
      );

      totalComments += result.commentCount;
      cumulativeStats.found += result.stats.found;
      cumulativeStats.new += result.stats.new;
      cumulativeStats.preexisting += result.stats.preexisting;
      cumulativeStats.ignored += result.stats.ignored;
      if (result.limitReached) batchLimitReached = true;
      completedVideos++;
      lastBatchProgress = { completedVideos, totalComments };
      await updateVideo(video.videoId, { commentsScraped: true });

      sendProgress(
        i + 1,
        video.videoId,
        `Collected post ${i + 1} of ${videosToProcess.length}`,
      );

      if (batchCancelled) {
        logger.log(
          "[Background] Batch cancelled after video scrape, breaking loop",
        );
        break;
      }
    }

    await cleanupScrapingSession();

    const wasCancelled = batchCancelled;
    batchCancelled = false;

    if (wasCancelled) {
      port.postMessage({
        type: MessageType.GET_BATCH_COMMENTS_ERROR,
        payload: {
          error: "Batch collecting cancelled",
          completedVideos,
          totalComments,
          stats: cumulativeStats,
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
          limitReached: batchLimitReached,
        },
      });
    }

    if (tab?.id) {
      closingTabsIntentionally.add(tab.id);
      chrome.tabs.remove(tab.id);
    }
    await focusDashboardTab();
  } catch (error) {
    batchCancelled = false;
    await cleanupScrapingSession();

    port.postMessage({
      type: MessageType.GET_BATCH_COMMENTS_ERROR,
      payload: {
        error: getErrorMessage(error),
        completedVideos,
        totalComments,
        stats: cumulativeStats,
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
  stats: { found: number; new: number; preexisting: number; ignored: number };
  limitReached: boolean;
}

/** Sends an API scrape message to the content script and resolves on completion. */
async function scrapeVideoInTab(
  tabId: number,
  videoId: string,
  onProgress: (videoId: string, message: string, stats?: ScrapeStats) => void,
): Promise<VideoScrapeResult> {
  return new Promise((resolve, reject) => {
    const responseHandler = (msg: ExtensionMessage) => {
      if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS) {
        const payload = msg.payload as {
          commentsFound?: number;
          message?: string;
          stats?: ScrapeStats;
        };
        onProgress(
          videoId,
          payload.message || `Found ${payload.commentsFound || 0} comments...`,
          payload.stats,
        );
      } else if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE) {
        const { comments, stats, limitReached } = msg.payload as {
          comments: ScrapedComment[];
          stats?: {
            found: number;
            new: number;
            preexisting: number;
            ignored: number;
          };
          limitReached?: boolean;
        };
        chrome.runtime.onMessage.removeListener(responseHandler);
        resolve({
          commentCount: comments?.length || 0,
          stats: stats || { found: 0, new: 0, preexisting: 0, ignored: 0 },
          limitReached: limitReached ?? false,
        });
      } else if (msg.type === MessageType.SCRAPE_VIDEO_COMMENTS_ERROR) {
        chrome.runtime.onMessage.removeListener(responseHandler);
        reject(
          new Error(
            (msg.payload as { error?: string })?.error || "Collecting failed",
          ),
        );
      }
    };

    chrome.runtime.onMessage.addListener(responseHandler);

    chrome.tabs.sendMessage(tabId, {
      type: MessageType.SCRAPE_VIDEO_COMMENTS_API_START,
    });
  });
}

function waitForTabLoad(tabId: number): Promise<void> {
  const config = getLoadedConfig();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new TabError("TAB_LOAD_TIMEOUT", "Tab load timeout", { tabId }));
    }, config.timeouts.tabLoad);

    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 750);
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
      logger.log(`[Background] Rate limit detected: ${errorMsg}`);

      // For 429 errors during active scraping, pause and set resume time
      const shouldPause = is429 && activeScrapingTabId !== null;
      const resumeAt = shouldPause
        ? new Date(Date.now() + 60000).toISOString()
        : undefined;

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
        logger.log(
          `[Background] 429 detected - pausing scraping for 60 seconds`,
        );
        chrome.tabs.sendMessage(activeScrapingTabId!, {
          type: MessageType.SCRAPE_PAUSE,
        });

        // Clear any existing resume timeout
        if (rateLimitResumeTimeout) {
          clearTimeout(rateLimitResumeTimeout);
        }

        // Auto-resume after 60 seconds
        rateLimitResumeTimeout = setTimeout(async () => {
          logger.log(`[Background] 60 seconds elapsed - resuming scraping`);
          if (activeScrapingTabId) {
            chrome.tabs.sendMessage(activeScrapingTabId, {
              type: MessageType.SCRAPE_RESUME,
            });
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
    logger.log(
      "[Background] Restored scraping state on startup, tabId:",
      state.tabId,
    );
  }
});

// Inject content scripts into already-open tabs
async function injectContentScripts(): Promise<void> {
  try {
    const dashboardTabs = await chrome.tabs.query({
      url: TOKATIVE_ENDPOINT_PATTERN,
    });
    for (const tab of dashboardTabs) {
      if (tab.id) {
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            files: ["content/dashboard-bridge.js"],
          })
          .catch((err) => {
            logger.log(
              "[Background] Could not inject into tab:",
              tab.id,
              err.message,
            );
          });
      }
    }

    const tiktokTabs = await chrome.tabs.query({
      url: "https://www.tiktok.com/*",
    });
    for (const tab of tiktokTabs) {
      if (tab.id) {
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            files: ["content/tiktok.js"],
          })
          .catch((err) => {
            logger.log(
              "[Background] Could not inject into tab:",
              tab.id,
              err.message,
            );
          });
      }
    }
  } catch (error) {
    logger.warn("[Background] Failed to inject content scripts:", error);
  }
}

// Load config on service worker startup
loadConfig()
  .then((config) => {
    logger.log("[Background] Config loaded");
  })
  .catch((error) => {
    logger.warn("[Background] Failed to load config:", error);
  });

// Inject content scripts on every service worker startup (handles re-enable)
injectContentScripts();

// Refresh config on extension install/update
chrome.runtime.onInstalled.addListener(async () => {
  logger.log("[Background] Extension installed/updated, refreshing config");
  refreshConfig().catch((error) => {
    logger.warn("[Background] Failed to refresh config on install:", error);
  });
});

logger.log("[Background] Tokative service worker initialized");
