import { ScrapedUser, ScrapeProgress, MessageType, ExtensionMessage } from "../../types";
import { humanDelay, humanDelayWithJitter, humanClick } from "../../utils/dom";
import { SELECTORS, querySelector, querySelectorAll, waitForSelector } from "./selectors";

let isScrapingActive = false;
let scrapePort: chrome.runtime.Port | null = null;
let scrapeOptions = { maxComments: 100 };

export interface ScrapeOptions {
  maxComments?: number;
}

export function startScraping(port: chrome.runtime.Port, options: ScrapeOptions = {}): void {
  if (isScrapingActive) {
    port.postMessage({
      type: MessageType.SCRAPE_COMMENTS_ERROR,
      payload: { error: "Scraping already in progress" },
    });
    return;
  }

  isScrapingActive = true;
  scrapePort = port;
  scrapeOptions = { maxComments: options.maxComments ?? 100 };
  runScraper();
}

export function stopScraping(): void {
  isScrapingActive = false;
  scrapePort = null;
}

async function runScraper(): Promise<void> {
  if (!scrapePort) return;

  const users: ScrapedUser[] = [];
  const seenIds = new Set<string>();

  Object.keys(extractionStats).forEach(key => extractionStats[key as keyof typeof extractionStats] = 0);

  try {
    sendProgress({ current: 0, total: 0, newUsers: 0, status: "scrolling", message: "Opening notifications..." });

    const activityBtn = await waitForSelector<HTMLElement>(SELECTORS.activityButton, { timeout: 5000 });
    if (!activityBtn) {
      throw new Error("Could not find Activity button. Make sure you're on TikTok and logged in.");
    }

    await humanClick(activityBtn);

    const panel = await waitForSelector(SELECTORS.notificationPanel, { timeout: 5000 });
    if (!panel) {
      throw new Error("Could not find notification panel");
    }

    await humanDelayWithJitter("short");

    sendProgress({ current: 0, total: 0, newUsers: 0, status: "scrolling", message: "Looking for Comments tab..." });

    const commentsTab = await waitForSelector<HTMLElement>(SELECTORS.commentsTab, { timeout: 3000 });
    if (commentsTab) {
      await humanClick(commentsTab);
    }

    await humanDelayWithJitter("medium");

    sendProgress({ current: 0, total: scrapeOptions.maxComments, newUsers: 0, status: "scrolling", message: "Waiting for comments to load..." });

    const firstItem = await waitForSelector(SELECTORS.inboxItem, { timeout: 10000 });
    if (!firstItem) {
      throw new Error("No comments found. Make sure you have comment notifications.");
    }

    await humanDelay("short");

    const scrollContainer = findVisibleElement(SELECTORS.inboxList) || panel;

    sendProgress({ current: 0, total: scrapeOptions.maxComments, newUsers: 0, status: "scrolling", message: "Scrolling through comments..." });

    let lastItemCount = 0;
    let noNewItemsCount = 0;

    while (isScrapingActive && users.length < scrapeOptions.maxComments) {
      const items = querySelectorAll(SELECTORS.inboxItem);

      sendProgress({
        current: users.length,
        total: scrapeOptions.maxComments,
        newUsers: users.length,
        status: "extracting",
        message: `Scraping... ${users.length}/${scrapeOptions.maxComments} comments`,
      });

      for (const item of items) {
        if (!isScrapingActive || users.length >= scrapeOptions.maxComments) break;

        const user = extractUserFromItem(item);
        if (user) {
          if (!seenIds.has(user.id)) {
            seenIds.add(user.id);
            users.push(user);
          } else {
            extractionStats.duplicate++;
          }
        }
      }


      if (users.length >= scrapeOptions.maxComments) break;

      if (items.length === lastItemCount) {
        noNewItemsCount++;
        if (noNewItemsCount >= 5) {
          sendProgress({
            current: users.length,
            total: scrapeOptions.maxComments,
            newUsers: users.length,
            status: "extracting",
            message: `No more comments to load. Found ${users.length} comments.`,
          });
          break;
        }
      } else {
        noNewItemsCount = 0;
      }
      lastItemCount = items.length;

      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;

      scrollContainer.scrollTop = Math.max(0, scrollHeight - clientHeight - 300);
      await humanDelay("micro");

      scrollContainer.scrollTop = scrollHeight;
      await humanDelayWithJitter("medium");
    }

    sendProgress({
      current: users.length,
      total: scrapeOptions.maxComments,
      newUsers: users.length,
      status: "complete",
      message: `Scraping complete! Found ${users.length} comments.`,
    });

    scrapePort?.postMessage({
      type: MessageType.SCRAPE_COMMENTS_COMPLETE,
      payload: { users },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    scrapePort?.postMessage({
      type: MessageType.SCRAPE_COMMENTS_ERROR,
      payload: { error: message },
    });
  } finally {
    isScrapingActive = false;
    scrapePort = null;
  }
}

const extractionStats = { noContent: 0, notComment: 0, noTitle: 0, noHandle: 0, success: 0, duplicate: 0 };

function extractUserFromItem(item: Element): ScrapedUser | null {
  try {
    const contentEl = querySelector(SELECTORS.inboxContent, item);
    if (!contentEl) {
      extractionStats.noContent++;
      return null;
    }

    const contentText = contentEl.textContent || "";
    if (!contentText.includes("commented:")) {
      extractionStats.notComment++;
      return null;
    }

    const titleEl = querySelector<HTMLAnchorElement>(SELECTORS.inboxTitle, item);
    const profileLinkEl = querySelector<HTMLAnchorElement>(SELECTORS.profileLink, item);

    if (!titleEl) {
      extractionStats.noTitle++;
      return null;
    }

    const handle = extractHandleFromHref(profileLinkEl?.href || titleEl.href);
    if (!handle) {
      extractionStats.noHandle++;
      return null;
    }

    const commentMatch = contentText.match(/commented:\s*(.+?)(?:\s*\d+[smhd]?\s*ago|$)/i);
    const comment = commentMatch ? commentMatch[1].trim() : "";

    const profileUrl = profileLinkEl?.href || titleEl.href || `https://www.tiktok.com/@${handle}`;

    // Extract video URL with comment ID from React props
    const videoUrl = extractVideoUrlFromReactProps(item);

    const id = generateStableId(handle, comment);

    extractionStats.success++;
    return {
      id,
      handle,
      comment,
      profileUrl,
      videoUrl,
      scrapedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function extractVideoUrlFromReactProps(item: Element): string {
  const liElement = item.closest('li');
  if (!liElement) {
    return extractVideoUrlFromHref(item);
  }

  // Check if we already extracted and cached the URL
  const cachedUrl = liElement.getAttribute('data-video-url-cached');
  if (cachedUrl !== null) {
    return cachedUrl;
  }

  // Generate unique ID for this element
  const extractId = `extract-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  liElement.setAttribute('data-extract-id', extractId);

  // Request extraction from main world (script injected at content script init)
  document.dispatchEvent(new CustomEvent('extract-react-props', {
    detail: { selector: `[data-extract-id="${extractId}"]` }
  }));

  // Check for result (main world script sets data-video-url-cached synchronously)
  const extractedUrl = liElement.getAttribute('data-video-url-cached');

  // Clean up
  liElement.removeAttribute('data-extract-id');

  if (extractedUrl) {
    return extractedUrl;
  }

  return extractVideoUrlFromHref(item);
}

function extractVideoUrlFromHref(item: Element): string {
  const videoLinks = item.querySelectorAll('a[href*="/video/"]');
  const videoLinkEl = videoLinks.length > 0 ? videoLinks[videoLinks.length - 1] as HTMLAnchorElement : null;
  return videoLinkEl?.href || "";
}

function extractHandleFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const match = href.match(/\/@([^/?]+)/);
  return match ? match[1] : null;
}

function generateStableId(handle: string, comment: string): string {
  const input = `${handle}:${comment}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${handle}-${Math.abs(hash).toString(36)}`;
}

function findVisibleElement(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return el;
      }
    }
  }
  return null;
}

function sendProgress(progress: ScrapeProgress): void {
  scrapePort?.postMessage({
    type: MessageType.SCRAPE_COMMENTS_PROGRESS,
    payload: progress,
  });
}
