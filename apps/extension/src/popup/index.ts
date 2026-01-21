import { MessageType } from "../types";
import { getUsers, getVideos } from "../utils/storage";

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
      const { videos: scrapedVideos } = message.payload as { videos: unknown[] };
      getVideos().then((allVideos) => {
        if (scrapeStatusEl) {
          scrapeStatusEl.className = "scrape-status success";
          scrapeStatusEl.textContent = `Scraped ${scrapedVideos?.length || 0} posts (${allVideos.length} total)`;
        }
        if (scrapeProfileBtn) scrapeProfileBtn.disabled = false;
      });
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

    scrapeProfileBtn.disabled = true;
    scrapeStatusEl.className = "scrape-status active";
    scrapeStatusEl.textContent = "Starting profile scrape...";

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        type: MessageType.SCRAPE_VIDEOS_START,
        payload: {},
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
