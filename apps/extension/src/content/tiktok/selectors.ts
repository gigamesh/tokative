export const SELECTORS = {
  activityButton: [
    '[data-e2e="nav-activity"]',
    '[aria-label="Activity"]',
  ],

  notificationPanel: [
    '[data-e2e="inbox-notifications"]',
  ],

  commentsTab: [
    '[data-e2e="comments"]',
    'button[role="tab"]:has-text("Comments")',
  ],

  inboxList: [
    '[data-e2e="inbox-list"]',
  ],

  inboxItem: [
    '[data-e2e="inbox-list-item"]',
  ],

  inboxTitle: [
    '[data-e2e="inbox-title"]',
  ],

  inboxContent: [
    '[data-e2e="inbox-content"]',
  ],

  profileLink: [
    'a[href*="/@"]',
  ],

  messageButton: [
    '[data-e2e="message-button"]',
    'a[href*="/messages?"]',
  ],

  messageInputArea: [
    '[data-e2e="message-input-area"]',
  ],

  messageInput: [
    '[data-e2e="message-input-area"] .public-DraftEditor-content[contenteditable="true"]',
    '[data-e2e="message-input-area"] [contenteditable="true"]',
    '.DraftEditor-root [contenteditable="true"]',
  ],
};

export function querySelector<T extends Element>(
  selectors: string[],
  parent: Element | Document = document
): T | null {
  for (const selector of selectors) {
    try {
      if (selector.includes(":has-text")) {
        const [base, text] = selector.split(":has-text");
        const textContent = text.replace(/[()""]/g, "");
        const elements = parent.querySelectorAll(base || "*");
        for (const el of elements) {
          if (el.textContent?.includes(textContent)) {
            return el as T;
          }
        }
      } else {
        const el = parent.querySelector<T>(selector);
        if (el) return el;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function querySelectorAll<T extends Element>(
  selectors: string[],
  parent: Element | Document = document
): T[] {
  const results: T[] = [];
  const seen = new Set<T>();

  for (const selector of selectors) {
    try {
      const elements = parent.querySelectorAll<T>(selector);
      for (const el of elements) {
        if (!seen.has(el)) {
          seen.add(el);
          results.push(el);
        }
      }
    } catch {
      continue;
    }
  }

  return results;
}

export async function waitForSelector<T extends Element>(
  selectors: string[],
  options: {
    timeout?: number;
    parent?: Element | Document;
  } = {}
): Promise<T | null> {
  const { timeout = 10000, parent = document } = options;

  const existing = querySelector<T>(selectors, parent);
  if (existing) return existing;

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = querySelector<T>(selectors, parent);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(parent, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}
