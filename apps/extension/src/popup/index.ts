import { MessageType } from "../types";
import { getUsers, getVideos, getPostLimit } from "../utils/storage";

async function init(): Promise<void> {
  const statusEl = document.getElementById("status");
  const userCountEl = document.getElementById("user-count");
  const sentCountEl = document.getElementById("sent-count");
  const openDashboardBtn = document.getElementById("open-dashboard");
  const scrapeProfileBtn = document.getElementById("scrape-profile") as HTMLButtonElement | null;
  const scrapeStatusEl = document.getElementById("scrape-status");

  const users = await getUsers();

  if (userCountEl) {
    userCountEl.textContent = users.length.toString();
  }

  if (sentCountEl) {
    const sentCount = users.filter((u) => u.messageSent).length;
    sentCountEl.textContent = sentCount.toString();
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
  const isOnProfilePage = activeTab?.url?.includes("tiktok.com/@");
  const postLimit = await getPostLimit();

  const postLimitHintEl = document.getElementById("post-limit-hint");
  if (postLimitHintEl) {
    postLimitHintEl.textContent = `Post limit: ${postLimit} (change in dashboard)`;
  }

  if (scrapeProfileBtn) {
    if (isOnProfilePage) {
      scrapeProfileBtn.disabled = false;
    } else {
      scrapeProfileBtn.disabled = true;
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status error";
        scrapeStatusEl.textContent = "Open a TikTok profile page to scrape";
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
  });

  scrapeProfileBtn?.addEventListener("click", async () => {
    if (!scrapeProfileBtn || !scrapeStatusEl) return;

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!currentTab?.id || !currentTab.url?.includes("tiktok.com/@")) {
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
}

document.addEventListener("DOMContentLoaded", init);
