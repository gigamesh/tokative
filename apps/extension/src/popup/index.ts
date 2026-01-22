import { MessageType } from "../types";
import { getUsers, getPostLimit, getCommentLimit } from "../utils/storage";

function isVideoPage(url: string | undefined): boolean {
  if (!url) return false;
  return /tiktok\.com\/@[^/]+\/video\/\d+/.test(url);
}

function isProfilePage(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes("tiktok.com/@") && !isVideoPage(url);
}

async function init(): Promise<void> {
  const statusEl = document.getElementById("status");
  const userCountEl = document.getElementById("user-count");
  const sentCountEl = document.getElementById("sent-count");
  const openDashboardBtn = document.getElementById("open-dashboard");
  const scrapeProfileBtn = document.getElementById("scrape-profile") as HTMLButtonElement | null;
  const scrapeStatusEl = document.getElementById("scrape-status");
  const scrapeCommentsBtn = document.getElementById("scrape-comments") as HTMLButtonElement | null;
  const commentScrapeStatusEl = document.getElementById("comment-scrape-status");

  const users = await getUsers();

  if (userCountEl) {
    userCountEl.textContent = users.length.toString();
  }

  if (sentCountEl) {
    const repliedCount = users.filter((u) => u.replySent).length;
    sentCountEl.textContent = repliedCount.toString();
  }

  const tabs = await chrome.tabs.query({ url: "http://localhost:3000/*" });
  const dashboardOpen = tabs.length > 0;

  if (statusEl) {
    if (dashboardOpen) {
      statusEl.className = "status connected";
      statusEl.textContent = "Dashboard connected";
    } else {
      statusEl.className = "status disconnected";
      statusEl.textContent = "Dashboard not open";
    }
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onProfilePage = isProfilePage(activeTab?.url);
  const onVideoPage = isVideoPage(activeTab?.url);
  const postLimit = await getPostLimit();
  const commentLimit = await getCommentLimit();

  const postLimitHintEl = document.getElementById("post-limit-hint");
  if (postLimitHintEl) {
    postLimitHintEl.textContent = `Post limit: ${postLimit} (change in dashboard)`;
  }

  const commentLimitHintEl = document.getElementById("comment-limit-hint");
  if (commentLimitHintEl) {
    commentLimitHintEl.textContent = `Comment limit: ${commentLimit} (change in dashboard)`;
  }

  if (scrapeProfileBtn) {
    if (onProfilePage) {
      scrapeProfileBtn.disabled = false;
    } else {
      scrapeProfileBtn.disabled = true;
      if (scrapeStatusEl && !onVideoPage) {
        scrapeStatusEl.className = "scrape-status error";
        scrapeStatusEl.textContent = "Open a TikTok profile page to scrape";
      }
    }
  }

  if (scrapeCommentsBtn) {
    if (onVideoPage) {
      scrapeCommentsBtn.disabled = false;
    } else {
      scrapeCommentsBtn.disabled = true;
      if (commentScrapeStatusEl && !onProfilePage) {
        commentScrapeStatusEl.className = "scrape-status error";
        commentScrapeStatusEl.textContent = "Open a TikTok video page to scrape comments";
      }
    }
  }

  openDashboardBtn?.addEventListener("click", async () => {
    if (dashboardOpen && tabs[0]?.id) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      window.close();
    } else {
      await chrome.tabs.create({ url: "http://localhost:3000" });
      window.close();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    // Profile scraping messages
    if (message.type === MessageType.SCRAPE_VIDEOS_PROGRESS) {
      const progress = message.payload;
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status active";
        scrapeStatusEl.textContent = progress.message || `${progress.videosFound} posts found...`;
      }
    } else if (message.type === MessageType.SCRAPE_VIDEOS_COMPLETE) {
      const { videos: scrapedVideos, limitReached } = message.payload as { videos: unknown[]; limitReached?: boolean };
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status success";
        const limitText = limitReached ? " · Limit reached" : "";
        scrapeStatusEl.textContent = `Scraped ${scrapedVideos?.length || 0} posts${limitText}`;
      }
      if (scrapeProfileBtn) scrapeProfileBtn.disabled = false;
    } else if (message.type === MessageType.SCRAPE_VIDEOS_ERROR) {
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status error";
        scrapeStatusEl.textContent = message.payload.error || "Scraping failed";
      }
      if (scrapeProfileBtn) scrapeProfileBtn.disabled = false;
    }

    // Comment scraping messages
    if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS) {
      const progress = message.payload;
      if (commentScrapeStatusEl) {
        commentScrapeStatusEl.className = "scrape-status active";
        commentScrapeStatusEl.textContent = progress.message || `${progress.commentsFound || 0} comments found...`;
      }
    } else if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE) {
      const { users: scrapedUsers } = message.payload as { users: unknown[] };
      if (commentScrapeStatusEl) {
        commentScrapeStatusEl.className = "scrape-status success";
        commentScrapeStatusEl.textContent = `Scraped ${scrapedUsers?.length || 0} comments`;
      }
      if (scrapeCommentsBtn) scrapeCommentsBtn.disabled = false;
    } else if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_ERROR) {
      if (commentScrapeStatusEl) {
        commentScrapeStatusEl.className = "scrape-status error";
        commentScrapeStatusEl.textContent = message.payload.error || "Comment scraping failed";
      }
      if (scrapeCommentsBtn) scrapeCommentsBtn.disabled = false;
    }
  });

  scrapeProfileBtn?.addEventListener("click", async () => {
    if (!scrapeProfileBtn || !scrapeStatusEl) return;

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!currentTab?.id || !isProfilePage(currentTab.url)) {
      scrapeStatusEl.className = "scrape-status error";
      scrapeStatusEl.textContent = "Navigate to a TikTok profile page first";
      return;
    }

    const postLimit = await getPostLimit();

    scrapeProfileBtn.disabled = true;
    scrapeStatusEl.className = "scrape-status active";
    scrapeStatusEl.textContent = `Scraping up to ${postLimit} posts...`;

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        type: MessageType.SCRAPE_VIDEOS_START,
        payload: { postLimit },
      });

      if (!response?.success) {
        scrapeStatusEl.className = "scrape-status error";
        scrapeStatusEl.textContent = response?.error || "Failed to start scraping";
        scrapeProfileBtn.disabled = false;
      }
    } catch (error) {
      scrapeStatusEl.className = "scrape-status error";
      scrapeStatusEl.textContent = error instanceof Error ? error.message : "Unknown error";
      scrapeProfileBtn.disabled = false;
    }
  });

  scrapeCommentsBtn?.addEventListener("click", async () => {
    if (!scrapeCommentsBtn || !commentScrapeStatusEl) return;

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!currentTab?.id || !isVideoPage(currentTab.url)) {
      commentScrapeStatusEl.className = "scrape-status error";
      commentScrapeStatusEl.textContent = "Navigate to a TikTok video page first";
      return;
    }

    const commentLimit = await getCommentLimit();

    scrapeCommentsBtn.disabled = true;
    commentScrapeStatusEl.className = "scrape-status active";
    commentScrapeStatusEl.textContent = `Scraping up to ${commentLimit} comments...`;

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        type: MessageType.SCRAPE_VIDEO_COMMENTS_START,
        payload: { maxComments: commentLimit },
      });

      if (!response?.success) {
        commentScrapeStatusEl.className = "scrape-status error";
        commentScrapeStatusEl.textContent = response?.error || "Failed to start comment scraping";
        scrapeCommentsBtn.disabled = false;
      }
    } catch (error) {
      commentScrapeStatusEl.className = "scrape-status error";
      commentScrapeStatusEl.textContent = error instanceof Error ? error.message : "Unknown error";
      scrapeCommentsBtn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
