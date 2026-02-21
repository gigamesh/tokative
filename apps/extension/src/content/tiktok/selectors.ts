import { getLoadedConfig } from "../../config/loader";
import { DEFAULT_CONFIG } from "../../config/defaults";

function getInboxSelectors(): Record<string, string[]> {
  try {
    return getLoadedConfig().selectors.inbox;
  } catch {
    return DEFAULT_CONFIG.selectors.inbox;
  }
}

export const SELECTORS = {
  get activityButton() { return getInboxSelectors().activityButton; },
  get notificationPanel() { return getInboxSelectors().notificationPanel; },
  get commentsTab() { return getInboxSelectors().commentsTab; },
  get inboxList() { return getInboxSelectors().inboxList; },
  get inboxItem() { return getInboxSelectors().inboxItem; },
  get inboxTitle() { return getInboxSelectors().inboxTitle; },
  get inboxContent() { return getInboxSelectors().inboxContent; },
  get profileLink() { return getInboxSelectors().profileLink; },
  get commentItem() { return getInboxSelectors().commentItem; },
  get commentUsername() { return getInboxSelectors().commentUsername; },
  get commentText() { return getInboxSelectors().commentText; },
  get commentReplyButton() { return getInboxSelectors().commentReplyButton; },
  get commentInput() { return getInboxSelectors().commentInput; },
  get commentPostButton() { return getInboxSelectors().commentPostButton; },
  get mentionButton() { return getInboxSelectors().mentionButton; },
  get mentionDropdown() { return getInboxSelectors().mentionDropdown; },
  get mentionItem() { return getInboxSelectors().mentionItem; },
  get mentionItemHandle() { return getInboxSelectors().mentionItemHandle; },
  get mentionTag() { return getInboxSelectors().mentionTag; },
};

/** Traverses UP the DOM via `.closest()`, trying each selector in order. */
export function closestMatch<T extends Element>(
  selectors: string[],
  element: Element
): T | null {
  for (const selector of selectors) {
    try {
      const match = element.closest<T>(selector);
      if (match) return match;
    } catch {
      continue;
    }
  }
  return null;
}

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
  const config = getLoadedConfig();
  const { timeout = config.timeouts.selectorWait, parent = document } = options;

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
