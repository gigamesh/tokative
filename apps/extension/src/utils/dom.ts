export function waitForElement<T extends Element = Element>(
  selector: string,
  options: {
    timeout?: number;
    parent?: Element | Document;
    visible?: boolean;
  } = {}
): Promise<T | null> {
  const { timeout = 10000, parent = document, visible = false } = options;

  return new Promise((resolve) => {
    const existing = parent.querySelector<T>(selector);
    if (existing && (!visible || isVisible(existing))) {
      return resolve(existing);
    }

    const observer = new MutationObserver(() => {
      const el = parent.querySelector<T>(selector);
      if (el && (!visible || isVisible(el))) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(parent, {
      childList: true,
      subtree: true,
      attributes: visible,
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

export function waitForElements<T extends Element = Element>(
  selector: string,
  options: {
    minCount?: number;
    timeout?: number;
    parent?: Element | Document;
  } = {}
): Promise<T[]> {
  const { minCount = 1, timeout = 10000, parent = document } = options;

  return new Promise((resolve) => {
    const existing = Array.from(parent.querySelectorAll<T>(selector));
    if (existing.length >= minCount) {
      return resolve(existing);
    }

    const observer = new MutationObserver(() => {
      const elements = Array.from(parent.querySelectorAll<T>(selector));
      if (elements.length >= minCount) {
        observer.disconnect();
        resolve(elements);
      }
    });

    observer.observe(parent, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(Array.from(parent.querySelectorAll<T>(selector)));
    }, timeout);
  });
}

export function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  // Basic CSS visibility checks
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    style.visibility === "hidden" ||
    style.display === "none" ||
    style.opacity === "0"
  ) {
    return false;
  }

  // Viewport visibility check - element must be at least partially visible
  // This is crucial for virtualized lists where recycled elements have dimensions
  // but are positioned off-screen
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Element is completely above or below the viewport
  if (rect.bottom < 0 || rect.top > viewportHeight) {
    return false;
  }

  // Element is completely left or right of the viewport
  if (rect.right < 0 || rect.left > viewportWidth) {
    return false;
  }

  return true;
}

export async function scrollToBottom(
  container: Element,
  options: {
    delay?: number;
    maxScrolls?: number;
    onScroll?: (scrollCount: number) => void;
  } = {}
): Promise<void> {
  const { delay = 1000, maxScrolls = 100, onScroll } = options;
  let scrollCount = 0;
  let lastScrollHeight = 0;

  while (scrollCount < maxScrolls) {
    const currentHeight = container.scrollHeight;

    if (currentHeight === lastScrollHeight) {
      break;
    }

    lastScrollHeight = currentHeight;
    container.scrollTop = currentHeight;
    scrollCount++;

    onScroll?.(scrollCount);

    await sleep(delay);
  }
}

export async function scrollIntoViewAndClick(element: Element): Promise<void> {
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(300);

  if (element instanceof HTMLElement) {
    element.click();
  } else {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    element.dispatchEvent(event);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}

function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type DelayProfile = "micro" | "short" | "medium" | "long" | "typing";

const DELAY_PROFILES: Record<DelayProfile, { mean: number; stdDev: number; min: number; max: number }> = {
  micro: { mean: 83, stdDev: 28, min: 28, max: 165 },
  short: { mean: 303, stdDev: 83, min: 165, max: 495 },
  medium: { mean: 660, stdDev: 220, min: 330, max: 1210 },
  long: { mean: 1210, stdDev: 330, min: 660, max: 2200 },
  typing: { mean: 72, stdDev: 28, min: 28, max: 154 },
};

export function humanDelay(profile: DelayProfile): Promise<void> {
  const { mean, stdDev, min, max } = DELAY_PROFILES[profile];
  const delay = clamp(Math.round(gaussianRandom(mean, stdDev)), min, max);
  return sleep(delay);
}

export async function humanDelayWithJitter(profile: DelayProfile): Promise<void> {
  await humanDelay(profile);

  if (Math.random() < 0.08) {
    const extraPause = Math.random() * 1500 + 500;
    await sleep(extraPause);
  }
}

export async function humanClick(element: Element): Promise<void> {
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  await humanDelay("short");

  if (element instanceof HTMLElement) {
    element.click();
  } else {
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    element.dispatchEvent(event);
  }

  await humanDelayWithJitter("medium");
}

export async function humanType(text: string): Promise<void> {
  for (const char of text) {
    document.execCommand("insertText", false, char);
    await humanDelay("typing");

    if (Math.random() < 0.03) {
      await humanDelay("short");
    }
  }
}

export async function typeText(
  input: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  options: { minDelay?: number; maxDelay?: number } = {}
): Promise<void> {
  const { minDelay = 30, maxDelay = 100 } = options;

  input.focus();

  for (const char of text) {
    input.value += char;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await randomDelay(minDelay, maxDelay);
  }
}

export function guardExtensionContext(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}
