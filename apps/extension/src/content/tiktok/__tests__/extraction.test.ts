import { SELECTORS, querySelector, querySelectorAll } from "../selectors";

const COMMENTS_LIST_HTML = `
<div data-e2e="inbox-list">
  <ul>
    <li>
      <div data-e2e="inbox-list-item">
        <a href="/@willisgs" data-e2e="inbox-title">willisgs</a>
        <p data-e2e="inbox-content">
          <span class="css-1qwdeqs"> commented: This is outrageous</span>&nbsp;3m ago
        </p>
      </div>
    </li>
    <li>
      <div data-e2e="inbox-list-item">
        <a href="/@kingsylver" data-e2e="inbox-title">Sylver⚜️</a>
        <p data-e2e="inbox-content">
          <span class="css-1qwdeqs"> commented: I just recently got into house music, what song is this? 😭</span>&nbsp;16m ago
        </p>
      </div>
    </li>
    <li>
      <div data-e2e="inbox-list-item">
        <a href="/@vandan.mp3" data-e2e="inbox-title">"</a>
        <p data-e2e="inbox-content">
          <span class="css-1qwdeqs"> commented: How soon we talking cuz I need this expeditiously</span>&nbsp;25m ago
        </p>
      </div>
    </li>
    <li>
      <div data-e2e="inbox-list-item">
        <a href="/@djferret8u" data-e2e="inbox-title">djferret8u</a>
        <p data-e2e="inbox-content">
          <span class="css-1qwdeqs"> commented:  [sticker]</span>&nbsp;7m ago
        </p>
      </div>
    </li>
  </ul>
</div>
`;

function extractHandleFromHref(href: string | undefined): string | null {
  if (!href) return null;
  const match = href.match(/\/@([^/?]+)/);
  return match ? match[1] : null;
}

function extractUserFromItem(item: Element) {
  const contentEl = querySelector(SELECTORS.inboxContent, item);
  if (!contentEl) return null;

  const contentText = contentEl.textContent || "";
  if (!contentText.includes("commented:")) return null;

  const titleEl = querySelector<HTMLAnchorElement>(SELECTORS.inboxTitle, item);
  const profileLinkEl = querySelector<HTMLAnchorElement>(SELECTORS.profileLink, item);

  if (!titleEl) return null;

  const handle = extractHandleFromHref(profileLinkEl?.href || titleEl.href);
  if (!handle) return null;

  const displayName = titleEl.textContent?.trim() || handle;

  const commentMatch = contentText.match(/commented:\s*(.+?)(?:\s*\d+[smhd]?\s*ago|$)/i);
  const comment = commentMatch ? commentMatch[1].trim() : "";

  const profileUrl = profileLinkEl?.href || titleEl.href || `https://www.tiktok.com/@${handle}`;

  return { handle, comment, profileUrl, displayName };
}

describe("Comment Extraction", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = COMMENTS_LIST_HTML;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("finds all inbox items", () => {
    const items = querySelectorAll(SELECTORS.inboxItem, container);
    expect(items.length).toBe(4);
  });

  it("extracts handle from href correctly", () => {
    expect(extractHandleFromHref("/@willisgs")).toBe("willisgs");
    expect(extractHandleFromHref("/@vandan.mp3")).toBe("vandan.mp3");
    expect(extractHandleFromHref("https://www.tiktok.com/@kingsylver")).toBe("kingsylver");
    expect(extractHandleFromHref(undefined)).toBeNull();
  });

  it("extracts user data from comment item", () => {
    const items = querySelectorAll(SELECTORS.inboxItem, container);
    const user = extractUserFromItem(items[0]);

    expect(user).not.toBeNull();
    expect(user?.handle).toBe("willisgs");
    expect(user?.comment).toBe("This is outrageous");
  });

  it("extracts user with emoji in display name", () => {
    const items = querySelectorAll(SELECTORS.inboxItem, container);
    const user = extractUserFromItem(items[1]);

    expect(user).not.toBeNull();
    expect(user?.handle).toBe("kingsylver");
    expect(user?.displayName).toBe("Sylver⚜️");
    expect(user?.comment).toContain("house music");
  });

  it("handles special characters in display name", () => {
    const items = querySelectorAll(SELECTORS.inboxItem, container);
    const user = extractUserFromItem(items[2]);

    expect(user).not.toBeNull();
    expect(user?.handle).toBe("vandan.mp3");
    expect(user?.displayName).toBe('"');
    expect(user?.comment).toContain("expeditiously");
  });

  it("extracts sticker comments", () => {
    const items = querySelectorAll(SELECTORS.inboxItem, container);
    const user = extractUserFromItem(items[3]);

    expect(user).not.toBeNull();
    expect(user?.handle).toBe("djferret8u");
    expect(user?.comment).toBe("[sticker]");
  });
});
