import { describe, it, expect, afterEach, vi } from "vitest";
import { ScrapedComment } from "../../../types";
import {
  normalizeText,
  verifyComment,
  checkCommentTextMatch,
} from "../comment-replier";

vi.stubGlobal("chrome", {
  runtime: {
    sendMessage: vi.fn(),
  },
});

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

describe("checkCommentTextMatch", () => {
  it("matches when found contains expected", () => {
    expect(checkCommentTextMatch("hello", "hello world")).toBe(true);
  });

  it("matches when expected contains found", () => {
    expect(checkCommentTextMatch("hello world", "hello")).toBe(true);
  });

  it("matches by first 20 characters for long strings", () => {
    const prefix = "this is a very long comment that starts the same way";
    expect(
      checkCommentTextMatch(prefix + " ending A", prefix + " ending B")
    ).toBe(true);
  });

  it("matches by word overlap (50%+ significant words)", () => {
    expect(
      checkCommentTextMatch(
        "great video content here today",
        "today great here video content"
      )
    ).toBe(true);
  });

  it("returns false for completely different text", () => {
    expect(checkCommentTextMatch("hello world", "goodbye moon")).toBe(false);
  });

  it("returns true when both are empty (empty contains empty)", () => {
    expect(checkCommentTextMatch("", "")).toBe(true);
  });
});

describe("verifyComment", () => {
  let container: HTMLElement;

  function createCommentDOM(handle: string, commentText: string): Element {
    container = document.createElement("div");
    container.innerHTML = `
      <div class="DivCommentObjectWrapper-abc123">
        <a href="https://www.tiktok.com/@${handle}">@${handle}</a>
        <span class="CommentText-xyz">${commentText}</span>
      </div>
    `;
    document.body.appendChild(container);
    return container.querySelector(".CommentText-xyz")!;
  }

  afterEach(() => {
    if (container?.parentNode) {
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
    const commentEl = createCommentDOM("testuser", "Test comment");
    const user = createScrapedComment({ handle: "testuser", comment: "Test comment" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
    expect(result.foundHandle).toBe("testuser");
  });

  it("returns match with case-insensitive handle comparison", () => {
    const commentEl = createCommentDOM("TestUser", "Test comment");
    const user = createScrapedComment({ handle: "testuser", comment: "Test comment" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
  });

  it("returns no match when handle differs", () => {
    const commentEl = createCommentDOM("otheruser", "Test comment");
    const user = createScrapedComment({ handle: "testuser", comment: "Test comment" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(false);
    expect(result.foundHandle).toBe("otheruser");
  });

  it("returns no match when comment differs", () => {
    const commentEl = createCommentDOM("testuser", "Totally unrelated words here");
    const user = createScrapedComment({ handle: "testuser", comment: "Something completely different now" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(false);
  });

  it("matches partial comments when one contains the other", () => {
    const commentEl = createCommentDOM("testuser", "This is the full comment text here");
    const user = createScrapedComment({ handle: "testuser", comment: "This is the full comment" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
  });

  it("matches comments by first 20 characters for long comments", () => {
    const longPrefix = "This is a very long comment that starts the same way";
    const commentEl = createCommentDOM("testuser", longPrefix + " but ends differently");
    const user = createScrapedComment({ handle: "testuser", comment: longPrefix + " with other ending" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
  });

  it("normalizes whitespace in comment comparison", () => {
    const commentEl = createCommentDOM("testuser", "Test   comment   here");
    const user = createScrapedComment({ handle: "testuser", comment: "Test comment here" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
  });

  it("handles emojis in comments", () => {
    const commentEl = createCommentDOM("testuser", "Great video! 🔥");
    const user = createScrapedComment({ handle: "testuser", comment: "Great video! 🔥" });

    const result = verifyComment(commentEl, user);

    expect(result.isMatch).toBe(true);
  });

  it("extracts handle from URL path correctly", () => {
    container = document.createElement("div");
    container.innerHTML = `
      <div class="DivCommentObjectWrapper-abc">
        <a href="https://www.tiktok.com/@user.name_123?refer=mention">@user.name_123</a>
        <span class="CommentText-xyz">Test</span>
      </div>
    `;
    document.body.appendChild(container);

    const commentEl = container.querySelector(".CommentText-xyz")!;
    const user = createScrapedComment({ handle: "user.name_123", comment: "Test" });

    const result = verifyComment(commentEl, user);

    expect(result.foundHandle).toBe("user.name_123");
    expect(result.isMatch).toBe(true);
  });

  it("extracts text from CommentText element in wrapper", () => {
    container = document.createElement("div");
    container.innerHTML = `
      <div class="DivCommentObjectWrapper-abc">
        <a href="/@testuser">@testuser</a>
        <span class="CommentText-xyz">This is the actual comment content that is much longer</span>
      </div>
    `;
    document.body.appendChild(container);

    const commentEl = container.querySelector(".CommentText-xyz")!;
    const user = createScrapedComment({
      handle: "testuser",
      comment: "This is the actual comment content that is much longer",
    });

    const result = verifyComment(commentEl, user);

    expect(result.foundComment).toBe("this is the actual comment content that is much longer");
    expect(result.isMatch).toBe(true);
  });

  it("falls back to commentElement textContent when no CommentText selector found", () => {
    container = document.createElement("div");
    container.innerHTML = `
      <div class="DivCommentObjectWrapper-abc">
        <a href="/@testuser">@testuser</a>
        <div class="other-class">
          <span data-e2e="comment-level-1">Fallback comment text</span>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const commentEl = container.querySelector('[data-e2e="comment-level-1"]')!;
    const user = createScrapedComment({
      handle: "testuser",
      comment: "Fallback comment text",
    });

    const result = verifyComment(commentEl, user);

    expect(result.foundComment).toBe("fallback comment text");
    expect(result.isMatch).toBe(true);
  });
});
