import { SELECTORS, closestMatch, querySelector, querySelectorAll } from "../selectors";

const ACTIVITY_BUTTON_HTML = `
<button class="TUXButton TUXButton--default TUXButton--medium TUXButton--secondary" data-e2e="nav-activity" aria-label="Activity" role="listitem">
  <div class="TUXButton-content">
    <div class="TUXButton-label">Activity</div>
  </div>
</button>
`;

const NOTIFICATION_PANEL_HTML = `
<div data-e2e="inbox-notifications" class="css-75qc1a">
  <div class="css-2kl231">
    <h2>Notifications</h2>
    <div data-e2e="inbox-bar" role="tablist">
      <button data-e2e="all" role="tab" aria-selected="true">All activity</button>
      <button data-e2e="likes" role="tab" aria-selected="false">Likes</button>
      <button data-e2e="comments" role="tab" aria-selected="false">Comments</button>
      <button data-e2e="mentions" role="tab" aria-selected="false">Mentions and tags</button>
      <button data-e2e="followers" role="tab" aria-selected="false">Followers</button>
    </div>
  </div>
  <div data-e2e="inbox-list" id="header-inbox-list" tabindex="0" role="tabpanel">
    <ul>
      <li>
        <div data-e2e="inbox-list-item">
          <a href="/@vandan.mp3" data-e2e="inbox-title">"</a>
          <p data-e2e="inbox-content">
            <span class="css-1qwdeqs"> commented: How soon we talking cuz I need this expeditiously</span> 4m ago
          </p>
        </div>
      </li>
      <li>
        <div data-e2e="inbox-list-item">
          <a href="/@sirnebulas" data-e2e="inbox-title">sir nebulas</a>
          <p data-e2e="inbox-content">
            <span class="css-1qwdeqs"> commented: 1 million likes incoming</span> 1h ago
          </p>
        </div>
      </li>
      <li>
        <div data-e2e="inbox-list-item">
          <a href="/@user123" data-e2e="inbox-title">user123</a>
          <p data-e2e="inbox-content">started following you. 24s ago</p>
        </div>
      </li>
      <li>
        <div data-e2e="inbox-list-item">
          <a href="/@simplydadd" data-e2e="inbox-title">Dad</a>
          <p data-e2e="inbox-content">
            <span class="css-1qwdeqs"> commented: That's clever as shit</span> 1h ago
          </p>
        </div>
      </li>
    </ul>
  </div>
</div>
`;

describe("TikTok Selectors", () => {
  describe("activityButton", () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement("div");
      container.innerHTML = ACTIVITY_BUTTON_HTML;
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it("finds activity button by data-e2e attribute", () => {
      const button = querySelector(SELECTORS.activityButton, container);
      expect(button).not.toBeNull();
      expect(button?.tagName).toBe("BUTTON");
      expect(button?.getAttribute("data-e2e")).toBe("nav-activity");
    });
  });

  describe("notificationPanel", () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement("div");
      container.innerHTML = NOTIFICATION_PANEL_HTML;
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it("finds notification panel", () => {
      const panel = querySelector(SELECTORS.notificationPanel, container);
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute("data-e2e")).toBe("inbox-notifications");
    });

    it("finds comments tab", () => {
      const tab = querySelector(SELECTORS.commentsTab, container);
      expect(tab).not.toBeNull();
      expect(tab?.getAttribute("data-e2e")).toBe("comments");
      expect(tab?.textContent).toBe("Comments");
    });

    it("finds inbox list", () => {
      const list = querySelector(SELECTORS.inboxList, container);
      expect(list).not.toBeNull();
      expect(list?.getAttribute("data-e2e")).toBe("inbox-list");
    });

    it("finds all inbox items", () => {
      const items = querySelectorAll(SELECTORS.inboxItem, container);
      expect(items.length).toBe(4);
    });

    it("finds inbox title within item", () => {
      const items = querySelectorAll(SELECTORS.inboxItem, container);
      const title = querySelector(SELECTORS.inboxTitle, items[1]);
      expect(title).not.toBeNull();
      expect(title?.textContent).toBe("sir nebulas");
    });

    it("finds inbox content within item", () => {
      const items = querySelectorAll(SELECTORS.inboxItem, container);
      const content = querySelector(SELECTORS.inboxContent, items[1]);
      expect(content).not.toBeNull();
      expect(content?.textContent).toContain("commented:");
      expect(content?.textContent).toContain("1 million likes incoming");
    });
  });

});

describe("closestMatch", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = `
      <div class="DivCommentObjectWrapper-abc123">
        <div class="DivContentContainer-xyz">
          <span id="inner">Hello</span>
        </div>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("returns the first matching ancestor", () => {
    const inner = container.querySelector("#inner")!;
    const match = closestMatch(
      ['[class*="DivContentContainer"]', '[class*="DivCommentObjectWrapper"]'],
      inner,
    );
    expect(match).not.toBeNull();
    expect(match!.className).toContain("DivContentContainer");
  });

  it("falls back to second selector when first doesn't match", () => {
    const inner = container.querySelector("#inner")!;
    const match = closestMatch(
      ['[class*="NoMatch"]', '[class*="DivCommentObjectWrapper"]'],
      inner,
    );
    expect(match).not.toBeNull();
    expect(match!.className).toContain("DivCommentObjectWrapper");
  });

  it("returns null when no selector matches", () => {
    const inner = container.querySelector("#inner")!;
    const match = closestMatch(['[class*="Nothing"]', '[class*="Nope"]'], inner);
    expect(match).toBeNull();
  });
});
