import { MessageType, CommentScrapingState, RateLimitState } from "../types";
import { getPostLimit, getScrapingState, getVideos, getRateLimitState } from "../utils/storage";
import { getAuthToken, clearAuthToken, requestAuthTokenFromWebApp } from "../utils/convex-api";

type AuthState =
  | { status: "not_authenticated" }
  | { status: "connecting" }
  | { status: "authenticated"; userId: string }
  | { status: "needs_sign_in" }
  | { status: "error"; message: string };

let authState: AuthState = { status: "not_authenticated" };

function updateScrapingStatusUI(
  statusEl: HTMLElement,
  state: CommentScrapingState,
  btn: HTMLButtonElement | null
): void {
  if (state.isPaused) {
    statusEl.className = "scrape-status paused";

    // Create elements properly instead of using innerHTML
    const span = document.createElement("span");
    span.className = "paused-text";
    span.textContent = `⏸ Paused (${state.commentsFound} comments) - `;

    const resumeLink = document.createElement("a");
    resumeLink.href = "#";
    resumeLink.textContent = "Click to resume";

    if (state.tabId) {
      const tabId = state.tabId;
      resumeLink.addEventListener("click", async (e) => {
        e.preventDefault();
        // Activate the tab first, which triggers SCRAPE_RESUME via background script
        await chrome.tabs.update(tabId, { active: true });
        // Close popup after a brief delay to ensure tab activation completes
        setTimeout(() => window.close(), 100);
      });
    }

    span.appendChild(resumeLink);
    statusEl.innerHTML = "";
    statusEl.appendChild(span);

    if (btn) btn.disabled = true;
  } else if (state.status === "scraping" || state.status === "loading") {
    statusEl.className = "scrape-status active";
    statusEl.textContent = state.message || `${state.commentsFound} comments found...`;
    if (btn) btn.disabled = true;
  } else if (state.status === "complete") {
    statusEl.className = "scrape-status success";
    statusEl.textContent = `Collected ${state.commentsFound} comments`;
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

function renderSpinnerWithText(container: HTMLElement, text: string): void {
  container.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "scrape-status-header";

  const spinner = document.createElement("div");
  spinner.className = "scrape-spinner";

  const textSpan = document.createElement("span");
  textSpan.textContent = text;

  wrapper.appendChild(spinner);
  wrapper.appendChild(textSpan);
  container.appendChild(wrapper);
}

function renderStatsTable(
  container: HTMLElement,
  stats: { found: number; new: number; ignored: number; preexisting: number },
  isComplete: boolean
): void {
  container.innerHTML = "";

  // Show spinner header when scraping is in progress
  if (!isComplete) {
    const header = document.createElement("div");
    header.className = "scrape-status-header";

    const spinner = document.createElement("div");
    spinner.className = "scrape-spinner";

    const headerText = document.createElement("span");
    headerText.textContent = "Collecting in progress...";

    header.appendChild(spinner);
    header.appendChild(headerText);
    container.appendChild(header);
  }

  const table = document.createElement("div");
  table.className = "stats-table";

  const rows = [
    { label: "Found", value: stats.found, className: "" },
    { label: "New", value: stats.new, className: "green" },
    { label: "Preexisting", value: stats.preexisting, className: "gray" },
    { label: "Ignored", value: stats.ignored, className: "gray" },
  ];

  rows.forEach(({ label, value, className }) => {
    const row = document.createElement("div");
    row.className = "stats-row";

    const labelSpan = document.createElement("span");
    labelSpan.className = "stats-label";
    labelSpan.textContent = label;

    const valueSpan = document.createElement("span");
    valueSpan.className = `stats-value ${className}`;
    valueSpan.textContent = String(value);

    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    table.appendChild(row);
  });

  container.appendChild(table);

  if (isComplete) {
    const note = document.createElement("div");
    note.className = "stats-note";
    note.innerHTML = `<strong>Preexisting:</strong> Already stored.<br><strong>Ignored:</strong> Matched ignore list.<br><strong>Note:</strong> TikTok's count may include deleted comments.`;
    container.appendChild(note);
  }
}

let rateLimitCountdownInterval: ReturnType<typeof setInterval> | null = null;

function showRateLimitWarning(state: RateLimitState): void {
  const warningEl = document.getElementById("rate-limit-warning");
  if (!warningEl) return;

  // Clear any existing countdown
  if (rateLimitCountdownInterval) {
    clearInterval(rateLimitCountdownInterval);
    rateLimitCountdownInterval = null;
  }

  if (state.isRateLimited && state.lastErrorAt) {
    // Only show if error was in the last 5 minutes
    const lastErrorTime = new Date(state.lastErrorAt).getTime();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (lastErrorTime > fiveMinutesAgo) {
      warningEl.style.display = "block";
      const errorTextEl = warningEl.querySelector(".rate-limit-text");

      if (errorTextEl) {
        // If paused for 429 with a resume time, show countdown
        if (state.isPausedFor429 && state.resumeAt) {
          const updateCountdown = () => {
            const resumeTime = new Date(state.resumeAt!).getTime();
            const remaining = Math.max(0, Math.ceil((resumeTime - Date.now()) / 1000));
            if (remaining > 0) {
              errorTextEl.textContent = `TikTok rate limit (429) - collecting paused. Resuming in ${remaining}s...`;
            } else {
              errorTextEl.textContent = `TikTok rate limit (429) - resuming collecting...`;
              if (rateLimitCountdownInterval) {
                clearInterval(rateLimitCountdownInterval);
                rateLimitCountdownInterval = null;
              }
            }
          };
          updateCountdown();
          rateLimitCountdownInterval = setInterval(updateCountdown, 1000);
        } else {
          errorTextEl.textContent = `TikTok rate limit detected (${state.errorCount} errors). Try waiting a few minutes before collecting again.`;
        }
      }
      return;
    }
  }
  warningEl.style.display = "none";
}

function hideRateLimitWarning(): void {
  if (rateLimitCountdownInterval) {
    clearInterval(rateLimitCountdownInterval);
    rateLimitCountdownInterval = null;
  }
  const warningEl = document.getElementById("rate-limit-warning");
  if (warningEl) {
    warningEl.style.display = "none";
  }
}

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
    // Disable if not authenticated
    if (authState.status !== "authenticated") {
      btn.disabled = true;
    }
  }
}

function renderAuthSection(): void {
  const section = document.getElementById("auth-section");
  const icon = document.getElementById("auth-status-icon");
  const text = document.getElementById("auth-status-text");
  const btn = document.getElementById("auth-connect-btn") as HTMLButtonElement | null;
  const helper = document.getElementById("auth-helper-text");

  if (!section || !icon || !text || !btn || !helper) return;

  section.className = "auth-section";
  section.style.display = "block";

  switch (authState.status) {
    case "not_authenticated":
    case "needs_sign_in":
      section.classList.add("not-connected");
      icon.textContent = "⚠️";
      text.textContent = authState.status === "needs_sign_in" ? "Sign in required" : "Not connected";
      text.className = "auth-status-text yellow";
      btn.textContent = "Connect to Dashboard";
      btn.style.display = "block";
      btn.disabled = false;
      helper.textContent = "Opens web app for authentication";
      helper.style.display = "block";
      break;

    case "connecting":
      section.classList.add("connecting");
      icon.innerHTML = '<span class="spinner"></span>';
      text.textContent = "Connecting...";
      text.className = "auth-status-text blue";
      btn.style.display = "none";
      helper.style.display = "none";
      break;

    case "authenticated":
      // Hide the entire auth section when connected - status is inferred from other content
      section.style.display = "none";
      break;

    case "error":
      section.classList.add("error");
      icon.textContent = "✕";
      text.textContent = authState.message || "Connection failed";
      text.className = "auth-status-text red";
      btn.textContent = "Retry";
      btn.style.display = "block";
      btn.disabled = false;
      helper.textContent = "Click to try again";
      helper.style.display = "block";
      break;
  }
}

function updateScrapeButtonsForAuth(): void {
  const isAuthed = authState.status === "authenticated";
  const scrapeProfileBtn = document.getElementById("scrape-profile") as HTMLButtonElement | null;
  const scrapeCommentsBtn = document.getElementById("scrape-comments") as HTMLButtonElement | null;
  const authHintProfile = document.getElementById("auth-not-connected-hint-profile");
  const authHintVideo = document.getElementById("auth-not-connected-hint-video");

  if (scrapeProfileBtn && !isProfileScraping) {
    scrapeProfileBtn.disabled = !isAuthed;
  }
  if (scrapeCommentsBtn && !isCommentScraping) {
    scrapeCommentsBtn.disabled = !isAuthed;
  }
}

async function initAuth(): Promise<void> {
  const token = await getAuthToken();
  authState = token
    ? { status: "authenticated", userId: token }
    : { status: "not_authenticated" };
  renderAuthSection();
  updateScrapeButtonsForAuth();
}

async function handleConnect(): Promise<void> {
  authState = { status: "connecting" };
  renderAuthSection();

  const token = await requestAuthTokenFromWebApp(3000);
  if (token) {
    authState = { status: "authenticated", userId: token };
  } else {
    chrome.runtime.sendMessage({ type: MessageType.OPEN_DASHBOARD_TAB });
    authState = { status: "not_authenticated" };
  }
  renderAuthSection();
  updateScrapeButtonsForAuth();
}

async function handleDisconnect(): Promise<void> {
  await clearAuthToken();
  authState = { status: "not_authenticated" };
  renderAuthSection();
  updateScrapeButtonsForAuth();
}

async function init(): Promise<void> {
  const profileSection = document.getElementById("profile-section");
  const videoSection = document.getElementById("video-section");
  const nonTiktokSection = document.getElementById("non-tiktok-section");
  const scrapeProfileBtn = document.getElementById("scrape-profile") as HTMLButtonElement | null;
  const scrapeStatusEl = document.getElementById("scrape-status");
  const scrapeCommentsBtn = document.getElementById("scrape-comments") as HTMLButtonElement | null;
  const commentScrapeStatusEl = document.getElementById("comment-scrape-status");
  const rateLimitDismissBtn = document.getElementById("rate-limit-dismiss");
  const authConnectBtn = document.getElementById("auth-connect-btn") as HTMLButtonElement | null;

  // Initialize auth state
  await initAuth();

  // Auth connect button handler
  authConnectBtn?.addEventListener("click", handleConnect);

  // Check for rate limit state on init
  const rateLimitState = await getRateLimitState();
  showRateLimitWarning(rateLimitState);

  // Rate limit dismiss button handler
  rateLimitDismissBtn?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: MessageType.CLEAR_RATE_LIMIT });
    hideRateLimitWarning();
  });

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
    const videoNotScrapedHintEl = document.getElementById("video-not-scraped-hint");

    const videoId = extractVideoId(activeTab?.url);
    const videos = await getVideos();
    const videoScraped = videoId && videos.some((v) => v.videoId === videoId);

    if (videoScraped) {
      if (videoNotScrapedHintEl) {
        videoNotScrapedHintEl.style.display = "none";
      }

      const scrapingState = await getScrapingState();
      if (scrapingState.isActive && scrapingState.videoId === videoId && commentScrapeStatusEl) {
        updateScrapingStatusUI(commentScrapeStatusEl, scrapingState, scrapeCommentsBtn);
      }
    } else {
      if (scrapeCommentsBtn) {
        scrapeCommentsBtn.disabled = true;
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
      updateScrapeButtonState(scrapeProfileBtn, true, "Collect Profile");
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status active";
        renderSpinnerWithText(scrapeStatusEl, progress.message || `${progress.videosFound} posts found...`);
      }
    } else if (message.type === MessageType.SCRAPE_VIDEOS_COMPLETE) {
      const { videos: scrapedVideos, limitReached } = message.payload as { videos: unknown[]; limitReached?: boolean };
      isProfileScraping = false;
      updateScrapeButtonState(scrapeProfileBtn, false, "Collect Profile");
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status success";
        const limitText = limitReached ? " · Limit reached" : "";
        scrapeStatusEl.textContent = `Collected ${scrapedVideos?.length || 0} posts${limitText}`;
      }
    } else if (message.type === MessageType.SCRAPE_VIDEOS_ERROR) {
      isProfileScraping = false;
      updateScrapeButtonState(scrapeProfileBtn, false, "Collect Profile");
      if (scrapeStatusEl) {
        scrapeStatusEl.className = "scrape-status error";
        scrapeStatusEl.textContent = message.payload.error || "Collecting failed";
      }
    }

    // Comment scraping messages
    if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS) {
      const progress = message.payload as { message?: string; stats?: { found: number; new: number; ignored: number; preexisting: number } };
      isCommentScraping = true;
      updateScrapeButtonState(scrapeCommentsBtn, true, "Collect Comments");
      if (commentScrapeStatusEl) {
        commentScrapeStatusEl.className = "scrape-status active";
        if (progress.stats) {
          renderStatsTable(commentScrapeStatusEl, progress.stats, false);
        } else {
          renderSpinnerWithText(commentScrapeStatusEl, progress.message || "Collecting...");
        }
      }
    } else if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE) {
      const payload = message.payload as { comments?: unknown[]; stats?: { found: number; new: number; ignored: number; preexisting: number } };
      isCommentScraping = false;
      updateScrapeButtonState(scrapeCommentsBtn, false, "Collect Comments");
      if (commentScrapeStatusEl) {
        commentScrapeStatusEl.className = "scrape-status success";
        if (payload.stats) {
          renderStatsTable(commentScrapeStatusEl, payload.stats, true);
        } else {
          commentScrapeStatusEl.textContent = `Collected ${payload.comments?.length || 0} comments`;
        }
      }
    } else if (message.type === MessageType.SCRAPE_VIDEO_COMMENTS_ERROR) {
      isCommentScraping = false;
      updateScrapeButtonState(scrapeCommentsBtn, false, "Collect Comments");
      if (commentScrapeStatusEl) {
        commentScrapeStatusEl.className = "scrape-status error";
        commentScrapeStatusEl.textContent = message.payload.error || "Comment collecting failed";
      }
    }

    if (message.type === MessageType.SCRAPE_PAUSED) {
      const state = message.payload as CommentScrapingState;
      if (state.isActive && commentScrapeStatusEl) {
        updateScrapingStatusUI(commentScrapeStatusEl, state, scrapeCommentsBtn);
      }
    }

    // Rate limit detection
    if (message.type === MessageType.RATE_LIMIT_DETECTED) {
      const state = message.payload as RateLimitState;
      showRateLimitWarning(state);
    }

    // Rate limit cleared (after 429 pause expires)
    if (message.type === MessageType.RATE_LIMIT_CLEARED) {
      hideRateLimitWarning();
    }

    // Auth token updates - when user signs in via web app
    if (message.type === MessageType.AUTH_TOKEN_RESPONSE) {
      const token = (message.payload as { token?: string })?.token;
      if (token) {
        authState = { status: "authenticated", userId: token };
        renderAuthSection();
        updateScrapeButtonsForAuth();
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
      updateScrapeButtonState(scrapeProfileBtn, false, "Collect Profile");
      scrapeStatusEl.className = "scrape-status error";
      scrapeStatusEl.textContent = "Collecting cancelled";
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
    updateScrapeButtonState(scrapeProfileBtn, true, "Collect Profile");
    scrapeStatusEl.className = "scrape-status active";
    renderSpinnerWithText(scrapeStatusEl, `Collecting up to ${postLimit} posts...`);

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        type: MessageType.SCRAPE_VIDEOS_START,
        payload: { postLimit },
      });

      if (!response?.success) {
        scrapeStatusEl.className = "scrape-status error";
        scrapeStatusEl.textContent = response?.error || "Failed to start collecting";
        isProfileScraping = false;
        updateScrapeButtonState(scrapeProfileBtn, false, "Collect Profile");
      }
    } catch (error) {
      scrapeStatusEl.className = "scrape-status error";
      scrapeStatusEl.textContent = error instanceof Error ? error.message : "Unknown error";
      isProfileScraping = false;
      updateScrapeButtonState(scrapeProfileBtn, false, "Collect Profile");
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
      updateScrapeButtonState(scrapeCommentsBtn, false, "Collect Comments");
      commentScrapeStatusEl.className = "scrape-status error";
      commentScrapeStatusEl.textContent = "Collecting cancelled";
      return;
    }

    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!currentTab?.id || !isVideoPage(currentTab.url)) {
      commentScrapeStatusEl.className = "scrape-status error";
      commentScrapeStatusEl.textContent = "Navigate to a TikTok video page first";
      return;
    }

    isCommentScraping = true;
    updateScrapeButtonState(scrapeCommentsBtn, true, "Collect Comments");
    commentScrapeStatusEl.className = "scrape-status active";
    renderSpinnerWithText(commentScrapeStatusEl, "Collecting comments...");

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        type: MessageType.SCRAPE_VIDEO_COMMENTS_START,
      });

      if (!response?.success) {
        commentScrapeStatusEl.className = "scrape-status error";
        commentScrapeStatusEl.textContent = response?.error || "Failed to start comment collecting";
        isCommentScraping = false;
        updateScrapeButtonState(scrapeCommentsBtn, false, "Collect Comments");
      }
    } catch (error) {
      commentScrapeStatusEl.className = "scrape-status error";
      commentScrapeStatusEl.textContent = error instanceof Error ? error.message : "Unknown error";
      isCommentScraping = false;
      updateScrapeButtonState(scrapeCommentsBtn, false, "Collect Comments");
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
