import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  sleep,
  randomDelay,
  isVisible,
  waitForElement,
  waitForElements,
  guardExtensionContext,
} from "../dom";

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after specified milliseconds", async () => {
    const promise = sleep(1000);
    vi.advanceTimersByTime(999);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(1);
    await promise;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resolves immediately for 0ms", async () => {
    const promise = sleep(0);
    vi.advanceTimersByTime(0);
    await promise;
  });
});

describe("randomDelay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("delays within the specified range", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const promise = randomDelay(100, 200);
    vi.advanceTimersByTime(150);
    await promise;
  });

  it("uses minimum delay when random is 0", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const promise = randomDelay(100, 200);
    vi.advanceTimersByTime(100);
    await promise;
  });

  it("uses maximum delay when random is 1", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99999);
    const promise = randomDelay(100, 200);
    vi.advanceTimersByTime(200);
    await promise;
  });
});

describe("isVisible", () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement("div");
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.removeChild(element);
  });

  it("returns true for visible element with dimensions", () => {
    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({ width: 100, height: 100 }),
    });
    element.style.visibility = "visible";
    element.style.display = "block";
    element.style.opacity = "1";

    expect(isVisible(element)).toBe(true);
  });

  it("returns false when element has no width", () => {
    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({ width: 0, height: 100 }),
    });
    expect(isVisible(element)).toBe(false);
  });

  it("returns false when element has no height", () => {
    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({ width: 100, height: 0 }),
    });
    expect(isVisible(element)).toBe(false);
  });

  it("returns false when visibility is hidden", () => {
    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({ width: 100, height: 100 }),
    });
    element.style.visibility = "hidden";
    expect(isVisible(element)).toBe(false);
  });

  it("returns false when display is none", () => {
    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({ width: 100, height: 100 }),
    });
    element.style.display = "none";
    expect(isVisible(element)).toBe(false);
  });

  it("returns false when opacity is 0", () => {
    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({ width: 100, height: 100 }),
    });
    element.style.opacity = "0";
    expect(isVisible(element)).toBe(false);
  });
});

describe("waitForElement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("returns existing element immediately", async () => {
    const element = document.createElement("div");
    element.id = "test-element";
    document.body.appendChild(element);

    const result = await waitForElement("#test-element");
    expect(result).toBe(element);
  });

  it("waits for element to appear", async () => {
    const promise = waitForElement("#new-element", { timeout: 5000 });

    setTimeout(() => {
      const element = document.createElement("div");
      element.id = "new-element";
      document.body.appendChild(element);
    }, 100);

    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).not.toBeNull();
    expect(result?.id).toBe("new-element");
  });

  it("returns null after timeout if element not found", async () => {
    const promise = waitForElement("#nonexistent", { timeout: 1000 });

    vi.advanceTimersByTime(1000);
    const result = await promise;

    expect(result).toBeNull();
  });

  it("respects custom parent element", async () => {
    const parent = document.createElement("div");
    const child = document.createElement("span");
    child.className = "target";
    parent.appendChild(child);
    document.body.appendChild(parent);

    const result = await waitForElement(".target", { parent });
    expect(result).toBe(child);
  });
});

describe("waitForElements", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("returns existing elements immediately when minCount is met", async () => {
    document.body.innerHTML = `
      <div class="item">1</div>
      <div class="item">2</div>
      <div class="item">3</div>
    `;

    const result = await waitForElements(".item", { minCount: 2 });
    expect(result.length).toBe(3);
  });

  it("waits until minCount elements appear", async () => {
    document.body.innerHTML = '<div class="item">1</div>';

    const promise = waitForElements(".item", { minCount: 2, timeout: 5000 });

    setTimeout(() => {
      const element = document.createElement("div");
      element.className = "item";
      document.body.appendChild(element);
    }, 100);

    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("returns available elements after timeout even if minCount not met", async () => {
    document.body.innerHTML = '<div class="item">1</div>';

    const promise = waitForElements(".item", { minCount: 5, timeout: 1000 });

    vi.advanceTimersByTime(1000);
    const result = await promise;

    expect(result.length).toBe(1);
  });
});

describe("guardExtensionContext", () => {
  it("returns true when chrome.runtime.id exists", () => {
    vi.stubGlobal("chrome", { runtime: { id: "test-extension-id" } });
    expect(guardExtensionContext()).toBe(true);
  });

  it("returns false when chrome.runtime.id is undefined", () => {
    vi.stubGlobal("chrome", { runtime: {} });
    expect(guardExtensionContext()).toBe(false);
  });

  it("returns false when chrome.runtime is undefined", () => {
    vi.stubGlobal("chrome", {});
    expect(guardExtensionContext()).toBe(false);
  });

  it("returns false when accessing chrome throws", () => {
    vi.stubGlobal("chrome", {
      get runtime() {
        throw new Error("Extension context invalidated");
      },
    });
    expect(guardExtensionContext()).toBe(false);
  });
});
