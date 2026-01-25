import { MessageType, CommentScrapingState } from "../types";
import { getPostLimit, getCommentLimit, getScrapingState, getVideos } from "../utils/storage";

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

function extractVideoId(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  return match ? match[1] : null;
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
    btn.className = "btn btn-primary";
  }
}

async function init(): Promise<void> {
  const profileSection = document.getElementById("profile-section");
  const videoSection = document.getElementById("video-section");
  const nonTiktokSection = document.getElementById("non-tiktok-section");
  const scrapeProfileBtn = document.getElementById("scrape-profile") as HTMLButtonElement | null;
  const scrapeStatusEl = document.getElementById("scrape-status");
  const scrapeCommentsBtn = document.getElementById("scrape-comments") as HTMLButtonElement | null;
  const commentScrapeStatusEl = document.getElementById("comment-scrape-status");

  // Determine current page type and show appropriate section
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const onProfilePage = isProfilePage(activeTab?.url);
  const onVideoPage = isVideoPage(activeTab?.url);

  if (onProfilePage && profileSection) {
    profileSection.style.display = "block";
    const postLimit = await getPostLimit();
    const postLimitHintEl = document.getElementById("post-limit-hint");
    if (postLimitHintEl) {
      postLimitHintEl.textContent = `Post limit: ${postLimit}`;
    }
  } else if (onVideoPage && videoSection) {
    videoSection.style.display = "block";
    const commentLimitHintEl = document.getElementById("comment-limit-hint");
    const videoNotScrapedHintEl = document.getElementById("video-not-scraped-hint");

    // Check if this video has been scraped
    const videoId = extractVideoId(activeTab?.url);
    const videos = await getVideos();
    const videoScraped = videoId && videos.some((v) => v.videoId === videoId);

    if (videoScraped) {
      const commentLimit = await getCommentLimit();
      if (commentLimitHintEl) {
        commentLimitHintEl.style.display = "block";
        commentLimitHintEl.textContent = `Comment limit: ${commentLimit}`;
      }
      if (videoNotScrapedHintEl) {
        videoNotScrapedHintEl.style.display = "none";
      }

      // Check for active scraping state for THIS video
      const scrapingState = await getScrapingState();
      if (scrapingState.isActive && scrapingState.videoId === videoId && commentScrapeStatusEl) {
        updateScrapingStatusUI(commentScrapeStatusEl, scrapingState, scrapeCommentsBtn);
      }
    } else {
      // Video not scraped - disable button and show message
      if (scrapeCommentsBtn) {
        scrapeCommentsBtn.disabled = true;
      }
      if (commentLimitHintEl) {
        commentLimitHintEl.style.display = "none";
      }
      if (videoNotScrapedHintEl) {
        videoNotScrapedHintEl.style.display = "block";
      }
    }
  } else if (nonTiktokSection) {
    nonTiktokSection.style.display = "block";
  }

  // Listen for scraping progress messages
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
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status success";
        const limitText = limitReached ? " · Limit reached" : "";
        scrapeStatusEl.textContent = `Scraped ${scrapedVideos?.length || 0} posts${limitText}`;
      }
    } else if (message.type === MessageType.SCRAPE_VIDEOS_ERROR) {
      isProfileScraping = false;
      updateScrapeButtonState(scrapeProfileBtn, false, "Scrape Profile");
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
      if (commentScrapeStatusEl) {
        commentScrapeStatusEl.className = "scrape-status success";
        commentScrapeStatusEl.textContent = `Scraped ${scrapedComments?.length || 0} comments`;
      }
    } else if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_ERROR) {
      isCommentScraping = false;
      updateScrapeButtonState(scrapeCommentsBtn, false, "Scrape Comments");
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

  // Profile scrape button click handler
  scrapeProfileBtn?.addEventListener("click", async () => {
    if (!scrapeProfileBtn || !scrapeStatusEl) return;

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
      }
    } catch (error) {
      scrapeStatusEl.className = "scrape-status error";
      scrapeStatusEl.textContent = error instanceof Error ? error.message : "Unknown error";
      isProfileScraping = false;
      updateScrapeButtonState(scrapeProfileBtn, false, "Scrape Profile");
    }
  });

  // Comment scrape button click handler
  scrapeCommentsBtn?.addEventListener("click", async () => {
    if (!scrapeCommentsBtn || !commentScrapeStatusEl) return;

    if (isCommentScraping) {
      // Send cancel to background script to handle batch cancellation
      try {
        await chrome.runtime.sendMessage({ type: MessageType.SCRAPE_VIDEO_COMMENTS_STOP });
      } catch {
        // Background might not be ready, also try the current tab
      }

      // Also send to current tab in case it's a single-video scrape
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
      }
    } catch (error) {
      commentScrapeStatusEl.className = "scrape-status error";
      commentScrapeStatusEl.textContent = error instanceof Error ? error.message : "Unknown error";
      isCommentScraping = false;
      updateScrapeButtonState(scrapeCommentsBtn, false, "Scrape Comments");
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
