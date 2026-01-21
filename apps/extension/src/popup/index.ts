import { MessageType } from "../types";
import { getUsers, saveUsers } from "../utils/storage";

async function init(): Promise<void> {
  const statusEl = document.getElementById("status");
  const userCountEl = document.getElementById("user-count");
  const sentCountEl = document.getElementById("sent-count");
  const openDashboardBtn = document.getElementById("open-dashboard");
  const scrapeVideoBtn = document.getElementById("scrape-video") as HTMLButtonElement | null;
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

  openDashboardBtn?.addEventListener("click", async () => {
    if (dashboardOpen && tabs[0]?.id) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      window.close();
    } else {
      await chrome.tabs.create({ url: "http://localhost:3000" });
      window.close();
    }
  });

  scrapeVideoBtn?.addEventListener("click", async () => {
    if (!scrapeVideoBtn || !scrapeStatusEl) return;

    const tiktokTabs = await chrome.tabs.query({ url: "*://*.tiktok.com/*" });
    const videoTab = tiktokTabs.find(tab => tab.url?.includes("/video/"));

    if (!videoTab?.id) {
      scrapeStatusEl.className = "scrape-status error";
      scrapeStatusEl.textContent = "No TikTok video page open";
      return;
    }

    scrapeVideoBtn.disabled = true;
    scrapeStatusEl.className = "scrape-status active";
    scrapeStatusEl.textContent = "Scraping comments...";

    try {
      const response = await chrome.tabs.sendMessage(videoTab.id, {
        type: MessageType.SCRAPE_VIDEO_COMMENTS_START,
        payload: {},
      });

      if (response?.success && response?.users) {
        const existingUsers = await getUsers();
        const existingIds = new Set(existingUsers.map(u => u.id));
        const newUsers = response.users.filter((u: { id: string }) => !existingIds.has(u.id));

        if (newUsers.length > 0) {
          await saveUsers([...existingUsers, ...newUsers]);
        }

        scrapeStatusEl.className = "scrape-status success";
        scrapeStatusEl.textContent = `Found ${response.users.length} comments (${newUsers.length} new)`;

        if (userCountEl) {
          userCountEl.textContent = (existingUsers.length + newUsers.length).toString();
        }
      } else {
        scrapeStatusEl.className = "scrape-status error";
        scrapeStatusEl.textContent = response?.error || "Scraping failed";
      }
    } catch (error) {
      scrapeStatusEl.className = "scrape-status error";
      scrapeStatusEl.textContent = error instanceof Error ? error.message : "Unknown error";
    } finally {
      scrapeVideoBtn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
