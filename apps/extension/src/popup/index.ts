import { MessageType, CommentScrapingState } from "../types";
import { getScrapedComments, getPostLimit, getCommentLimit, getScrapingState } from "../utils/storage";

function updateScrapingStatusUI(
  statusEl: HTMLElement,
  state: CommentScrapingState,
  btn: HTMLButtonElement | null
): void {
  if (state.isPaused) {
    statusEl.className = "scrape-status paused";
    statusEl.innerHTML = `<span class="paused-text">⏸ Paused (${state.commentsFound} comments) - <a href="#" id="resume-scrape">Click to resume</a></span>`;
    if (btn) btn.disabled = true;

    const resumeLink = document.getElementById("resume-scrape");
    if (resumeLink && state.tabId) {
      resumeLink.addEventListener("click", async (e) => {
        e.preventDefault();
        await chrome.tabs.update(state.tabId!, { active: true });
        window.close();
      });
    }
  } else if (state.status === "scraping" || state.status === "loading") {
    statusEl.className = "scrape-status active";
    statusEl.textContent = state.message || `${state.commentsFound} comments found...`;
    if (btn) btn.disabled = true;
  } else if (state.status === "complete") {
    statusEl.className = "scrape-status success";
    statusEl.textContent = `Scraped ${state.commentsFound} comments`;
    if (btn) btn.disabled = false;
  }
}

function isVideoPage(url: string | undefined): boolean {
  if (!url) return false;
  return /tiktok\.com\/@[^/]+\/video\/\d+/.test(url);
}

function isProfilePage(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes("tiktok.com/@") && !isVideoPage(url);
}

let isProfileScraping = false;
let isCommentScraping = false;

function updateScrapeButtonState(
  btn: HTMLButtonElement | null,
  isScraping: boolean,
  defaultText: string
): void {
  if (!btn) return;
  if (isScraping) {
    btn.textContent = "Cancel";
    btn.className = "btn btn-cancel";
    btn.disabled = false;
  } else {
    btn.textContent = defaultText;
    btn.className = "btn btn-secondary";
  }
}

async function init(): Promise<void> {
  const statusEl = document.getElementById("status");
  const userCountEl = document.getElementById("user-count");
  const sentCountEl = document.getElementById("sent-count");
  const scrapeProfileBtn = document.getElementById("scrape-profile") as HTMLButtonElement | null;
  const scrapeStatusEl = document.getElementById("scrape-status");
  const scrapeCommentsBtn = document.getElementById("scrape-comments") as HTMLButtonElement | null;
  const commentScrapeStatusEl = document.getElementById("comment-scrape-status");

  const comments = await getScrapedComments();

  if (userCountEl) {
    userCountEl.textContent = comments.length.toString();
  }

  if (sentCountEl) {
    const repliedCount = comments.filter((c) => c.replySent).length;
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

  const scrapingState = await getScrapingState();
  if (scrapingState.isActive && commentScrapeStatusEl) {
    updateScrapingStatusUI(commentScrapeStatusEl, scrapingState, scrapeCommentsBtn);
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

  chrome.runtime.onMessage.addListener((message) => {
    // Profile scraping messages
    if (message.type === MessageType.SCRAPE_VIDEOS_PROGRESS) {
      const progress = message.payload;
      isProfileScraping = true;
      updateScrapeButtonState(scrapeProfileBtn, true, "Scrape Profile");
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status active";
        scrapeStatusEl.textContent = progress.message || `${progress.videosFound} posts found...`;
      }
    } else if (message.type === MessageType.SCRAPE_VIDEOS_COMPLETE) {
      const { videos: scrapedVideos, limitReached } = message.payload as { videos: unknown[]; limitReached?: boolean };
      isProfileScraping = false;
      updateScrapeButtonState(scrapeProfileBtn, false, "Scrape Profile");
      if (scrapeProfileBtn && onProfilePage) scrapeProfileBtn.disabled = false;
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status success";
        const limitText = limitReached ? " · Limit reached" : "";
        scrapeStatusEl.textContent = `Scraped ${scrapedVideos?.length || 0} posts${limitText}`;
      }
    } else if (message.type === MessageType.SCRAPE_VIDEOS_ERROR) {
      isProfileScraping = false;
      updateScrapeButtonState(scrapeProfileBtn, false, "Scrape Profile");
      if (scrapeProfileBtn && onProfilePage) scrapeProfileBtn.disabled = false;
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status error";
        scrapeStatusEl.textContent = message.payload.error || "Scraping failed";
      }
    }

    // Comment scraping messages
    if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS) {
      const progress = message.payload;
      isCommentScraping = true;
      updateScrapeButtonState(scrapeCommentsBtn, true, "Scrape Comments");
      if (commentScrapeStatusEl) {
        commentScrapeStatusEl.className = "scrape-status active";
        commentScrapeStatusEl.textContent = progress.message || `${progress.commentsFound || 0} comments found...`;
      }
    } else if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE) {
      const { comments: scrapedComments } = message.payload as { comments: unknown[] };
      isCommentScraping = false;
      updateScrapeButtonState(scrapeCommentsBtn, false, "Scrape Comments");
      if (scrapeCommentsBtn && onVideoPage) scrapeCommentsBtn.disabled = false;
      if (commentScrapeStatusEl) {
        commentScrapeStatusEl.className = "scrape-status success";
        commentScrapeStatusEl.textContent = `Scraped ${scrapedComments?.length || 0} comments`;
      }
    } else if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_ERROR) {
      isCommentScraping = false;
      updateScrapeButtonState(scrapeCommentsBtn, false, "Scrape Comments");
      if (scrapeCommentsBtn && onVideoPage) scrapeCommentsBtn.disabled = false;
      if (commentScrapeStatusEl) {
        commentScrapeStatusEl.className = "scrape-status error";
        commentScrapeStatusEl.textContent = message.payload.error || "Comment scraping failed";
      }
    }

    if (message.type === MessageType.SCRAPE_PAUSED) {
      const state = message.payload as CommentScrapingState;
      if (state.isActive && commentScrapeStatusEl) {
        updateScrapingStatusUI(commentScrapeStatusEl, state, scrapeCommentsBtn);
      }
    }
  });

  scrapeProfileBtn?.addEventListener("click", async () => {
    if (!scrapeProfileBtn || !scrapeStatusEl) return;

    // Handle cancel
    if (isProfileScraping) {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currentTab?.id) {
        try {
          await chrome.tabs.sendMessage(currentTab.id, { type: MessageType.SCRAPE_VIDEOS_STOP });
        } catch {
          // Tab might have changed, ignore
        }
      }
      isProfileScraping = false;
      updateScrapeButtonState(scrapeProfileBtn, false, "Scrape Profile");
      scrapeStatusEl.className = "scrape-status error";
      scrapeStatusEl.textContent = "Scraping cancelled";
      if (onProfilePage) scrapeProfileBtn.disabled = false;
      return;
    }

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!currentTab?.id || !isProfilePage(currentTab.url)) {
      scrapeStatusEl.className = "scrape-status error";
      scrapeStatusEl.textContent = "Navigate to a TikTok profile page first";
      return;
    }

    const postLimit = await getPostLimit();

    isProfileScraping = true;
    updateScrapeButtonState(scrapeProfileBtn, true, "Scrape Profile");
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
        isProfileScraping = false;
        updateScrapeButtonState(scrapeProfileBtn, false, "Scrape Profile");
        if (onProfilePage) scrapeProfileBtn.disabled = false;
      }
    } catch (error) {
      scrapeStatusEl.className = "scrape-status error";
      scrapeStatusEl.textContent = error instanceof Error ? error.message : "Unknown error";
      isProfileScraping = false;
      updateScrapeButtonState(scrapeProfileBtn, false, "Scrape Profile");
      if (onProfilePage) scrapeProfileBtn.disabled = false;
    }
  });

  scrapeCommentsBtn?.addEventListener("click", async () => {
    if (!scrapeCommentsBtn || !commentScrapeStatusEl) return;

    // Handle cancel
    if (isCommentScraping) {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currentTab?.id) {
        try {
          await chrome.tabs.sendMessage(currentTab.id, { type: MessageType.SCRAPE_VIDEO_COMMENTS_STOP });
        } catch {
          // Tab might have changed, ignore
        }
      }
      isCommentScraping = false;
      updateScrapeButtonState(scrapeCommentsBtn, false, "Scrape Comments");
      commentScrapeStatusEl.className = "scrape-status error";
      commentScrapeStatusEl.textContent = "Scraping cancelled";
      if (onVideoPage) scrapeCommentsBtn.disabled = false;
      return;
    }

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!currentTab?.id || !isVideoPage(currentTab.url)) {
      commentScrapeStatusEl.className = "scrape-status error";
      commentScrapeStatusEl.textContent = "Navigate to a TikTok video page first";
      return;
    }

    const commentLimit = await getCommentLimit();

    isCommentScraping = true;
    updateScrapeButtonState(scrapeCommentsBtn, true, "Scrape Comments");
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
        isCommentScraping = false;
        updateScrapeButtonState(scrapeCommentsBtn, false, "Scrape Comments");
        if (onVideoPage) scrapeCommentsBtn.disabled = false;
      }
    } catch (error) {
      commentScrapeStatusEl.className = "scrape-status error";
      commentScrapeStatusEl.textContent = error instanceof Error ? error.message : "Unknown error";
      isCommentScraping = false;
      updateScrapeButtonState(scrapeCommentsBtn, false, "Scrape Comments");
      if (onVideoPage) scrapeCommentsBtn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
