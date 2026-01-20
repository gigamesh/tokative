import { MessageType } from "../types";
import { getUsers } from "../utils/storage";

async function init(): Promise<void> {
  const statusEl = document.getElementById("status");
  const userCountEl = document.getElementById("user-count");
  const sentCountEl = document.getElementById("sent-count");
  const openDashboardBtn = document.getElementById("open-dashboard");

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
}

document.addEventListener("DOMContentLoaded", init);
