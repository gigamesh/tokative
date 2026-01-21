import { VIDEO_SELECTORS } from "../video-selectors";
import { querySelector, querySelectorAll } from "../selectors";

const VIDEO_COMMENT_HTML = `
<div class="DivCommentListContainer-abc123">
  <div class="DivCommentItemContainer-xyz789">
    <div class="DivCommentContentContainer-def456" id="7596124584026653471">
      <a data-e2e="comment-username-1" href="/@testuser">testuser</a>
      <p data-e2e="comment-level-1">
        <span data-e2e="comment-text">This is a test comment!</span>
      </p>
      <p data-e2e="comment-time-1">2d ago</p>
      <p data-e2e="comment-reply-1">Reply</p>
    </div>
  </div>
  <div class="DivCommentItemContainer-xyz789">
    <div class="DivCommentContentContainer-def456" id="7596124584026653472">
      <a data-e2e="comment-username-1" href="/@anotheruser">another.user_123</a>
      <p data-e2e="comment-level-1">
        <span data-e2e="comment-text">Great video! 🔥</span>
      </p>
      <p data-e2e="comment-time-1">5h ago</p>
      <p data-e2e="comment-reply-1">Reply</p>
    </div>
  </div>
</div>
`;

const VIDEO_PAGE_META_HTML = `
<head>
  <meta property="og:image" content="https://p16-sign-sg.tiktokcdn.com/obj/thumbnail.jpeg">
  <meta property="og:url" content="https://www.tiktok.com/@creator/video/7596052026111347998">
</head>
`;

interface VideoCommentData {
  commentId: string;
  handle: string;
  comment: string;
  videoId: string;
  videoThumbnailUrl: string;
}

function extractHandleFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const match = href.match(/\/@([^/?]+)/);
  return match ? match[1] : null;
}

function extractVideoIdFromUrl(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

function extractCommentFromElement(commentContainer: Element): Partial<VideoCommentData> | null {
  const contentEl = querySelector(VIDEO_SELECTORS.commentContent, commentContainer);
  if (!contentEl) return null;

  const commentId = contentEl.getAttribute("id");
  if (!commentId) return null;

  const usernameEl = querySelector<HTMLAnchorElement>(VIDEO_SELECTORS.commentUsername, commentContainer);
  const handle = extractHandleFromHref(usernameEl?.href);
  if (!handle) return null;

  const textEl = querySelector(VIDEO_SELECTORS.commentText, commentContainer);
  const comment = textEl?.textContent?.trim() || "";

  return { commentId, handle, comment };
}

function extractVideoMetadata(doc: Document = document): { videoId: string | null; thumbnailUrl: string | null } {
  const ogImage = doc.querySelector<HTMLMetaElement>(VIDEO_SELECTORS.videoMetaThumbnail[0]);
  const ogUrl = doc.querySelector<HTMLMetaElement>(VIDEO_SELECTORS.videoMetaUrl[0]);

  return {
    videoId: ogUrl ? extractVideoIdFromUrl(ogUrl.content) : null,
    thumbnailUrl: ogImage?.content || null,
  };
}

describe("Video Page Selectors", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = VIDEO_COMMENT_HTML;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("finds comments container", () => {
    const commentsContainer = querySelector(VIDEO_SELECTORS.commentsContainer, container);
    expect(commentsContainer).not.toBeNull();
    expect(commentsContainer?.className).toContain("DivCommentListContainer");
  });

  it("finds all comment items", () => {
    const items = querySelectorAll(VIDEO_SELECTORS.commentItem, container);
    expect(items.length).toBe(2);
  });

  it("finds comment content element with id", () => {
    const items = querySelectorAll(VIDEO_SELECTORS.commentItem, container);
    const content = querySelector(VIDEO_SELECTORS.commentContent, items[0]);
    expect(content).not.toBeNull();
    expect(content?.getAttribute("id")).toBe("7596124584026653471");
  });

  it("finds comment username", () => {
    const items = querySelectorAll(VIDEO_SELECTORS.commentItem, container);
    const username = querySelector<HTMLAnchorElement>(VIDEO_SELECTORS.commentUsername, items[0]);
    expect(username).not.toBeNull();
    expect(username?.textContent).toBe("testuser");
    expect(username?.href).toContain("/@testuser");
  });

  it("finds comment text", () => {
    const items = querySelectorAll(VIDEO_SELECTORS.commentItem, container);
    const text = querySelector(VIDEO_SELECTORS.commentText, items[0]);
    expect(text).not.toBeNull();
    expect(text?.textContent).toBe("This is a test comment!");
  });

  it("finds reply button", () => {
    const items = querySelectorAll(VIDEO_SELECTORS.commentItem, container);
    const replyBtn = querySelector(VIDEO_SELECTORS.commentReplyButton, items[0]);
    expect(replyBtn).not.toBeNull();
    expect(replyBtn?.textContent).toBe("Reply");
  });
});

describe("Video Meta Tags", () => {
  let head: HTMLElement;

  beforeEach(() => {
    head = document.createElement("div");
    head.innerHTML = VIDEO_PAGE_META_HTML;
    document.head.innerHTML = VIDEO_PAGE_META_HTML.replace(/<\/?head>/g, "");
  });

  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("extracts video thumbnail from og:image", () => {
    const { thumbnailUrl } = extractVideoMetadata();
    expect(thumbnailUrl).toBe("https://p16-sign-sg.tiktokcdn.com/obj/thumbnail.jpeg");
  });

  it("extracts video ID from og:url", () => {
    const { videoId } = extractVideoMetadata();
    expect(videoId).toBe("7596052026111347998");
  });
});

describe("Comment Data Extraction", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = VIDEO_COMMENT_HTML;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("extracts handle from href correctly", () => {
    expect(extractHandleFromHref("/@testuser")).toBe("testuser");
    expect(extractHandleFromHref("/@another.user_123")).toBe("another.user_123");
    expect(extractHandleFromHref("https://www.tiktok.com/@creator")).toBe("creator");
    expect(extractHandleFromHref(undefined)).toBeNull();
  });

  it("extracts video ID from URL correctly", () => {
    expect(extractVideoIdFromUrl("https://www.tiktok.com/@creator/video/7596052026111347998")).toBe("7596052026111347998");
    expect(extractVideoIdFromUrl("/video/1234567890")).toBe("1234567890");
    expect(extractVideoIdFromUrl("https://www.tiktok.com/@user")).toBeNull();
  });

  it("extracts comment data from element", () => {
    const items = querySelectorAll(VIDEO_SELECTORS.commentItem, container);
    const data = extractCommentFromElement(items[0]);

    expect(data).not.toBeNull();
    expect(data?.commentId).toBe("7596124584026653471");
    expect(data?.handle).toBe("testuser");
    expect(data?.comment).toBe("This is a test comment!");
  });

  it("handles special characters in handle and emoji in comment", () => {
    const items = querySelectorAll(VIDEO_SELECTORS.commentItem, container);
    const data = extractCommentFromElement(items[1]);

    expect(data).not.toBeNull();
    expect(data?.handle).toBe("anotheruser");
    expect(data?.comment).toBe("Great video! 🔥");
  });
});
