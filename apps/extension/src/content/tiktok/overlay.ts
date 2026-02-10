import { colors } from "@tokative/shared";
import type {
  ScrapeStats,
  VideoMetadataScrapeProgress,
  VideoScrapeProgress,
} from "../../types";

const OVERLAY_HOST_ID = "tokative-overlay-host";

let shadowRoot: ShadowRoot | null = null;
let hostEl: HTMLElement | null = null;
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
let cancelHandler: (() => void) | null = null;

type OverlayMode = "comments" | "profile";
let currentMode: OverlayMode = "comments";

function getStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .modal {
      width: 360px;
      background: ${colors.background.dark};
      border-radius: 16px;
      border: 1px solid ${colors.background.hover};
      overflow: hidden;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
    }

    .header {
      padding: 20px 24px 12px;
      text-align: center;
    }

    .header h1 {
      font-size: 20px;
      font-weight: 700;
      display: inline-block;
      background: linear-gradient(to right, #25f4ee, ${colors.brand.primary});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      color: transparent;
    }

    .body {
      padding: 8px 24px 24px;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 0;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2.5px solid ${colors.background.hover};
      border-top-color: ${colors.brand.primary};
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .status-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      line-height: 1;
    }

    .status-text {
      font-size: 14px;
      color: ${colors.text.secondary};
      line-height: 1.4;
    }

    .stats-table {
      width: 100%;
      margin-top: 12px;
      border-collapse: collapse;
    }

    .stats-table tr {
      border-bottom: 1px solid ${colors.background.elevated};
    }

    .stats-table tr:last-child {
      border-bottom: none;
    }

    .stats-table td {
      padding: 6px 0;
      font-size: 13px;
    }

    .stats-table td:first-child {
      color: ${colors.text.muted};
    }

    .stats-table td:last-child {
      text-align: right;
      color: ${colors.text.primary};
      font-variant-numeric: tabular-nums;
    }

    .rate-limit {
      margin-top: 12px;
      padding: 8px 12px;
      background: rgba(251, 191, 36, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(251, 191, 36, 0.2);
      font-size: 12px;
      color: ${colors.status.warning};
      display: none;
    }

    .rate-limit.visible {
      display: block;
    }

    .cancel-btn {
      display: block;
      width: 100%;
      margin-top: 16px;
      padding: 10px;
      background: transparent;
      color: ${colors.text.muted};
      border: 1px solid ${colors.background.hover};
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .cancel-btn:hover {
      background: ${colors.background.hover};
      color: ${colors.text.primary};
      border-color: ${colors.text.muted};
    }

    .footer-note {
      margin-top: 12px;
      font-size: 11px;
      color: ${colors.text.muted};
      text-align: center;
      line-height: 1.4;
      opacity: 0.7;
    }

    /* State color variants */
    .status-text.paused { color: ${colors.status.warning}; }
    .status-text.error { color: ${colors.status.error}; }
    .status-text.complete { color: ${colors.status.success}; }
  `;
}

function getTemplate(): string {
  return `
    <style>${getStyles()}</style>
    <div class="backdrop">
      <div class="modal">
        <div class="header">
          <h1>Tokative</h1>
        </div>
        <div class="body">
          <div class="status">
            <div class="spinner" id="status-indicator"></div>
            <span class="status-text" id="status-text">Starting...</span>
          </div>
          <table class="stats-table" id="stats-table" style="display: none;">
            <tr><td>Found</td><td id="stat-found">0</td></tr>
            <tr><td>New</td><td id="stat-new">0</td></tr>
            <tr><td>Pre-existing</td><td id="stat-preexisting">0</td></tr>
            <tr><td>Ignored</td><td id="stat-ignored">0</td></tr>
          </table>
          <div class="rate-limit" id="rate-limit">
            Rate limit detected — waiting before retrying...
          </div>
          <button class="cancel-btn" id="cancel-btn">Cancel</button>
          <p class="footer-note" id="footer-note">This tab must remain open while collecting.</p>
        </div>
      </div>
    </div>
  `;
}

function el(id: string): HTMLElement | null {
  return shadowRoot?.getElementById(id) ?? null;
}

function clearAutoHide(): void {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}

function setStatusIndicator(
  type: "spinner" | "icon",
  content?: string,
  color?: string,
): void {
  const indicator = el("status-indicator");
  if (!indicator) return;

  if (type === "spinner") {
    indicator.className = "spinner";
    indicator.textContent = "";
  } else {
    indicator.className = "status-icon";
    indicator.textContent = content ?? "";
    if (color) indicator.style.color = color;
  }
}

/** Creates and attaches the overlay to the page. */
export function showOverlay(mode: OverlayMode, onCancel?: () => void): void {
  hideOverlay();
  currentMode = mode;
  cancelHandler = onCancel ?? null;

  hostEl = document.createElement("div");
  hostEl.id = OVERLAY_HOST_ID;
  shadowRoot = hostEl.attachShadow({ mode: "closed" });
  shadowRoot.innerHTML = getTemplate();

  const statusText = el("status-text");
  if (statusText) {
    statusText.textContent =
      mode === "comments" ? "Collecting comments..." : "Collecting videos...";
  }

  const cancelBtn = el("cancel-btn");
  if (cancelBtn && cancelHandler) {
    cancelBtn.addEventListener("click", cancelHandler);
  }

  document.documentElement.appendChild(hostEl);
}

/** Updates overlay with comment or profile scraping progress. */
export function updateOverlayProgress(
  progress: VideoScrapeProgress | VideoMetadataScrapeProgress,
): void {
  if (!shadowRoot) return;

  const statusText = el("status-text");
  const rateLimit = el("rate-limit");

  if (currentMode === "comments") {
    const p = progress as VideoScrapeProgress;

    if (statusText) {
      statusText.className = "status-text";
      statusText.textContent =
        p.message || `Collecting comments... (${p.commentsFound} found)`;
    }

    if (p.stats) {
      renderStats(p.stats);
    }

    if (rateLimit) {
      rateLimit.classList.toggle(
        "visible",
        p.message?.toLowerCase().includes("rate") ?? false,
      );
    }

    setStatusIndicator("spinner");
  } else {
    const p = progress as VideoMetadataScrapeProgress;

    if (statusText) {
      statusText.className = "status-text";
      statusText.textContent =
        p.message || `Collecting videos... (${p.videosFound} found)`;
    }

    setStatusIndicator("spinner");
  }
}

/** Shows paused state with amber styling. */
export function updateOverlayPaused(): void {
  if (!shadowRoot) return;

  const statusText = el("status-text");
  if (statusText) {
    statusText.className = "status-text paused";
    statusText.textContent = "Paused — switch back to this tab to continue";
  }

  setStatusIndicator("icon", "⏸", colors.status.warning);
}

/** Returns overlay to active scraping state. */
export function updateOverlayResumed(): void {
  if (!shadowRoot) return;

  const statusText = el("status-text");
  if (statusText) {
    statusText.className = "status-text";
    statusText.textContent =
      currentMode === "comments"
        ? "Collecting comments..."
        : "Collecting videos...";
  }

  setStatusIndicator("spinner");
}

/** Shows completion summary, auto-hides after 3 seconds. */
export function updateOverlayComplete(stats?: ScrapeStats): void {
  if (!shadowRoot) return;
  clearAutoHide();

  const statusText = el("status-text");
  if (statusText) {
    statusText.className = "status-text complete";
    if (stats) {
      statusText.textContent = `Done — ${stats.new} new comments saved`;
    } else {
      statusText.textContent = "Collection complete";
    }
  }

  if (stats) renderStats(stats);
  setStatusIndicator("icon", "✓", colors.status.success);

  const rateLimit = el("rate-limit");
  if (rateLimit) rateLimit.classList.remove("visible");

  hideActiveControls();
  autoHideTimer = setTimeout(hideOverlay, 3000);
}

declare const TOKATIVE_ENDPOINT_PLACEHOLDER: string;

/** Shows limit-reached state with upgrade prompt. */
export function updateOverlayLimitReached(
  monthlyLimit: number,
  currentCount: number,
  plan: string,
): void {
  if (!shadowRoot) return;
  clearAutoHide();

  const statusText = el("status-text");
  if (statusText) {
    statusText.className = "status-text error";
    const tokativeEndpoint = TOKATIVE_ENDPOINT_PLACEHOLDER;
    statusText.innerHTML =
      `Monthly comment limit reached (${currentCount.toLocaleString()}/${monthlyLimit.toLocaleString()}).` +
      ` <a href="${tokativeEndpoint}/pricing" target="_blank" ` +
      `style="color: ${colors.brand.primary}; text-decoration: underline;">Upgrade to collect more.</a>`;
  }

  setStatusIndicator("icon", "!", colors.status.warning);
}

/** Shows error state, auto-hides after 5 seconds. */
export function updateOverlayError(message: string): void {
  if (!shadowRoot) return;
  clearAutoHide();

  const statusText = el("status-text");
  if (statusText) {
    statusText.className = "status-text error";
    statusText.textContent = message;
  }

  setStatusIndicator("icon", "✕", colors.status.error);

  hideActiveControls();
  autoHideTimer = setTimeout(hideOverlay, 5000);
}

function hideActiveControls(): void {
  const cancelBtn = el("cancel-btn");
  if (cancelBtn) cancelBtn.style.display = "none";
  const footerNote = el("footer-note");
  if (footerNote) footerNote.style.display = "none";
}

/** Removes the overlay from the DOM. */
export function hideOverlay(): void {
  clearAutoHide();
  cancelHandler = null;
  if (hostEl) {
    hostEl.remove();
    hostEl = null;
    shadowRoot = null;
  }
}

function renderStats(stats: ScrapeStats): void {
  const table = el("stats-table");
  if (table) table.style.display = "";

  const found = el("stat-found");
  const newEl = el("stat-new");
  const preexisting = el("stat-preexisting");
  const ignored = el("stat-ignored");

  if (found) found.textContent = String(stats.found);
  if (newEl) newEl.textContent = String(stats.new);
  if (preexisting) preexisting.textContent = String(stats.preexisting);
  if (ignored) ignored.textContent = String(stats.ignored);
}
