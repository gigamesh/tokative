import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ScrapedComment } from "../../../types";

vi.stubGlobal("chrome", {
  runtime: {
    sendMessage: vi.fn(),
  },
});

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100);
}

interface VerificationResult {
  isMatch: boolean;
  foundHandle: string;
  foundComment: string;
}

function verifyComment(commentElement: Element, user: ScrapedComment): VerificationResult {
  const targetHandle = user.handle.toLowerCase();
  const targetComment = normalizeText(user.comment);

  const commentWrapper = commentElement.closest('[class*="DivCommentObjectWrapper"]')
    || commentElement.closest('[class*="CommentItem"]')
    || commentElement.parentElement?.parentElement?.parentElement;

  const handleLink = commentWrapper?.querySelector('a[href*="/@"]') as HTMLAnchorElement;

  const href = handleLink?.href || "";
  const handleMatch = href.match(/\/@([^/?]+)/);
  const foundHandle = handleMatch ? handleMatch[1].toLowerCase() : "";

  let foundComment = "";
  const textEls = commentElement.querySelectorAll('span');
  for (const textEl of textEls) {
    const text = textEl.textContent || "";
    if (text.length > foundComment.length && text.length < 500) {
      foundComment = text;
    }
  }
  foundComment = normalizeText(foundComment);

  const handleMatches = foundHandle === targetHandle;

  const commentMatches =
    foundComment.includes(targetComment) ||
    targetComment.includes(foundComment) ||
    (foundComment.length > 10 && targetComment.length > 10 &&
      (foundComment.substring(0, 20) === targetComment.substring(0, 20)));

  return {
    isMatch: handleMatches && commentMatches,
    foundHandle,
    foundComment,
  };
}

describe("normalizeText", () => {
  it("converts text to lowercase", () => {
    expect(normalizeText("HELLO WORLD")).toBe("hello world");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeText("hello    world")).toBe("hello world");
  });

  it("trims whitespace", () => {
    expect(normalizeText("  hello world  ")).toBe("hello world");
  });

  it("truncates to 100 characters", () => {
    const longText = "a".repeat(150);
    expect(normalizeText(longText)).toHaveLength(100);
  });

  it("handles mixed whitespace characters", () => {
    expect(normalizeText("hello\n\t  world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(normalizeText("")).toBe("");
  });

  it("handles emojis", () => {
    expect(normalizeText("Great video! 🔥")).toBe("great video! 🔥");
  });
});

describe("verifyComment", () => {
  let container: HTMLElement;

  function createCommentElement(handle: string, commentText: string): Element {
    container = document.createElement("div");
    container.innerHTML = `
      <div class="DivCommentObjectWrapper-abc123">
        <a href="https://www.tiktok.com/@${handle}">@${handle}</a>
        <div class="comment-content">
          <span>${commentText}</span>
        </div>
      </div>
    `;
    document.body.appendChild(container);
    return container.querySelector(".comment-content")!;
  }

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  function createScrapedComment(overrides: Partial<ScrapedComment> = {}): ScrapedComment {
    return {
      id: "test-id",
      tiktokUserId: "7023701638964954118",
      handle: "testuser",
      comment: "Test comment",
      scrapedAt: new Date().toISOString(),
      profileUrl: "https://tiktok.com/@testuser",
      ...overrides,
    };
  }

  it("returns match when handle and comment match exactly", () => {
    const commentEl = createCommentElement("testuser", "Test comment");
    const user = createScrapedComment({ handle: "testuser", comment: "Test comment" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
    expect(result.foundHandle).toBe("testuser");
  });

  it("returns match with case-insensitive handle comparison", () => {
    const commentEl = createCommentElement("TestUser", "Test comment");
    const user = createScrapedComment({ handle: "testuser", comment: "Test comment" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
  });

  it("returns no match when handle differs", () => {
    const commentEl = createCommentElement("otheruser", "Test comment");
    const user = createScrapedComment({ handle: "testuser", comment: "Test comment" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(false);
    expect(result.foundHandle).toBe("otheruser");
  });

  it("returns no match when comment differs", () => {
    const commentEl = createCommentElement("testuser", "Different comment");
    const user = createScrapedComment({ handle: "testuser", comment: "Test comment" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(false);
    expect(result.foundComment).toBe("different comment");
  });

  it("matches partial comments when one contains the other", () => {
    const commentEl = createCommentElement("testuser", "This is the full comment text here");
    const user = createScrapedComment({ handle: "testuser", comment: "This is the full comment" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
  });

  it("matches comments by first 20 characters for long comments", () => {
    const longPrefix = "This is a very long comment that starts the same way";
    const commentEl = createCommentElement("testuser", longPrefix + " but ends differently");
    const user = createScrapedComment({ handle: "testuser", comment: longPrefix + " with other ending" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
  });

  it("normalizes whitespace in comment comparison", () => {
    const commentEl = createCommentElement("testuser", "Test   comment   here");
    const user = createScrapedComment({ handle: "testuser", comment: "Test comment here" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
  });

  it("handles emojis in comments", () => {
    const commentEl = createCommentElement("testuser", "Great video! 🔥");
    const user = createScrapedComment({ handle: "testuser", comment: "Great video! 🔥" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
  });

  it("extracts handle from URL path correctly", () => {
    container = document.createElement("div");
    container.innerHTML = `
      <div class="DivCommentObjectWrapper-abc">
        <a href="https://www.tiktok.com/@user.name_123?refer=mention">@user.name_123</a>
        <div class="comment-content">
          <span>Test</span>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const commentEl = container.querySelector(".comment-content")!;
    const user = createScrapedComment({ handle: "user.name_123", comment: "Test" });

    const result = verifyComment(commentEl, user);

    expect(result.foundHandle).toBe("user.name_123");
    expect(result.isMatch).toBe(true);
  });
});

describe("Comment Element Detection", () => {
  let container: HTMLElement;

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it("finds longest span text as comment content", () => {
    container = document.createElement("div");
    container.innerHTML = `
      <div class="DivCommentObjectWrapper-abc">
        <a href="/@testuser">@testuser</a>
        <div class="content">
          <span>Short</span>
          <span>This is the actual comment content that is much longer</span>
          <span>Also short</span>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const commentEl = container.querySelector(".content")!;
    const user: ScrapedComment = {
      id: "1",
      tiktokUserId: "7023701638964954118",
      handle: "testuser",
      comment: "This is the actual comment content that is much longer",
      scrapedAt: "",
      profileUrl: "",
    };

    const result = verifyComment(commentEl, user);

    expect(result.foundComment).toBe("this is the actual comment content that is much longer");
    expect(result.isMatch).toBe(true);
  });

  it("ignores spans longer than 500 characters", () => {
    container = document.createElement("div");
    const longText = "x".repeat(600);
    container.innerHTML = `
      <div class="DivCommentObjectWrapper-abc">
        <a href="/@testuser">@testuser</a>
        <div class="content">
          <span>${longText}</span>
          <span>Actual comment</span>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const commentEl = container.querySelector(".content")!;
    const user: ScrapedComment = {
      id: "1",
      tiktokUserId: "7023701638964954118",
      handle: "testuser",
      comment: "Actual comment",
      scrapedAt: "",
      profileUrl: "",
    };

    const result = verifyComment(commentEl, user);

    expect(result.foundComment).toBe("actual comment");
  });
});
