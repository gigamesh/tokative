import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockStorage, createMockChromeStorage } from "../../__tests__/chrome-mock";
import { DEFAULT_CONFIG } from "../defaults";

const mockStorage = createMockStorage();
const mockChromeStorage = createMockChromeStorage(mockStorage);

vi.stubGlobal("chrome", {
  storage: mockChromeStorage,
  runtime: { getManifest: () => ({ version: "1.1.0" }) },
});

vi.stubGlobal("fetch", vi.fn());

import { loadConfig, refreshConfig, getLoadedConfig, clearConfigCache } from "../loader";

const CACHE_KEY = "tokative_remote_config";

function makeRemoteConfig(overrides: Record<string, unknown> = {}) {
  return {
    minExtensionVersion: "1.0.0",
    timeouts: { selectorWait: 8000 },
    ...overrides,
  };
}

function seedCache(config: Record<string, unknown>, fetchedAt?: number) {
  mockStorage[CACHE_KEY] = {
    config: { ...DEFAULT_CONFIG, ...config },
    fetchedAt: fetchedAt ?? Date.now(),
  };
}

describe("Config Loader", () => {
  beforeEach(() => {
    clearConfigCache();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe("getLoadedConfig", () => {
    it("returns DEFAULT_CONFIG when nothing has been loaded", () => {
      expect(getLoadedConfig()).toBe(DEFAULT_CONFIG);
    });
  });

  describe("loadConfig", () => {
    it("returns memory-cached config on subsequent calls without re-fetching", async () => {
      const remote = makeRemoteConfig();
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(remote),
      });

      const first = await loadConfig();
      const second = await loadConfig();

      expect(first).toBe(second);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("uses local storage cache when available and fresh", async () => {
      seedCache({ minExtensionVersion: "1.0.0" });

      const config = await loadConfig();

      expect(fetch).not.toHaveBeenCalled();
      expect(config.minExtensionVersion).toBe("1.0.0");
    });

    it("ignores expired local storage cache", async () => {
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      seedCache({ minExtensionVersion: "1.0.0" }, sixMinutesAgo);

      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeRemoteConfig()),
      });

      await loadConfig();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("fetches remote config and merges with defaults", async () => {
      const remote = makeRemoteConfig({ timeouts: { selectorWait: 5000 } });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(remote),
      });

      const config = await loadConfig();

      expect(config.timeouts.selectorWait).toBe(5000);
      // Non-overridden defaults are preserved
      expect(config.timeouts.skeletonLoader).toBe(DEFAULT_CONFIG.timeouts.skeletonLoader);
      expect(config.selectors).toBeDefined();
    });

    it("caches fetched config to local storage", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeRemoteConfig()),
      });

      await loadConfig();

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [CACHE_KEY]: expect.objectContaining({
            config: expect.any(Object),
            fetchedAt: expect.any(Number),
          }),
        }),
      );
    });

    it("falls back to DEFAULT_CONFIG when fetch fails", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

      const config = await loadConfig();

      expect(config).toBe(DEFAULT_CONFIG);
    });

    it("falls back to DEFAULT_CONFIG when response is not ok", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const config = await loadConfig();

      expect(config).toBe(DEFAULT_CONFIG);
    });

    it("falls back to DEFAULT_CONFIG when config is invalid", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ foo: "bar" }),
      });

      const config = await loadConfig();

      expect(config).toBe(DEFAULT_CONFIG);
    });

    it("falls back to DEFAULT_CONFIG when version is incompatible", async () => {
      const remote = makeRemoteConfig({ minExtensionVersion: "99.0.0" });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(remote),
      });

      const config = await loadConfig();

      expect(config).toBe(DEFAULT_CONFIG);
    });

    it("populates getLoadedConfig after successful load", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeRemoteConfig({ timeouts: { selectorWait: 7777 } })),
      });

      await loadConfig();

      expect(getLoadedConfig().timeouts.selectorWait).toBe(7777);
    });
  });

  describe("refreshConfig", () => {
    it("clears memory and local cache, then re-fetches", async () => {
      // Prime the caches
      seedCache({ minExtensionVersion: "1.0.0" });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(makeRemoteConfig()),
      });

      await loadConfig(); // populates memory cache from local
      expect(fetch).not.toHaveBeenCalled();

      await refreshConfig();

      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith(CACHE_KEY);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("returns DEFAULT_CONFIG when refresh fetch fails", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));

      const config = await refreshConfig();

      expect(config).toBe(DEFAULT_CONFIG);
    });
  });

  describe("clearConfigCache", () => {
    it("causes getLoadedConfig to return DEFAULT_CONFIG", async () => {
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeRemoteConfig({ timeouts: { selectorWait: 1234 } })),
      });
      await loadConfig();
      expect(getLoadedConfig().timeouts.selectorWait).toBe(1234);

      clearConfigCache();

      expect(getLoadedConfig()).toBe(DEFAULT_CONFIG);
    });
  });

  describe("mergeWithDefaults", () => {
    it("deep-merges selectors, preserving defaults for missing keys", async () => {
      const remote = makeRemoteConfig({
        selectors: {
          video: { commentItem: ['[data-test="custom"]'] },
        },
      });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(remote),
      });

      const config = await loadConfig();

      expect(config.selectors.video.commentItem).toEqual(['[data-test="custom"]']);
      // Non-overridden video selectors preserved
      expect(config.selectors.video.commentsScroller).toEqual(
        DEFAULT_CONFIG.selectors.video.commentsScroller,
      );
      // Inbox selectors fully preserved
      expect(config.selectors.inbox).toEqual(DEFAULT_CONFIG.selectors.inbox);
    });

    it("deep-merges delay profiles", async () => {
      const remote = makeRemoteConfig({
        delays: {
          profiles: { micro: { mean: 50, stdDev: 15, min: 20, max: 80 } },
        },
      });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(remote),
      });

      const config = await loadConfig();

      expect(config.delays.profiles.micro).toEqual({ mean: 50, stdDev: 15, min: 20, max: 80 });
      expect(config.delays.profiles.short).toEqual(DEFAULT_CONFIG.delays.profiles.short);
    });

    it("merges optional messages field", async () => {
      const remote = makeRemoteConfig({
        messages: { overlayFooter: "Custom footer" },
      });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(remote),
      });

      const config = await loadConfig();

      expect(config.messages?.overlayFooter).toBe("Custom footer");
    });

    it("deep-merges api sub-objects, preserving defaults for missing keys", async () => {
      const remote = makeRemoteConfig({
        api: {
          endpoints: { commentList: "https://www.tiktok.com/api/v2/comment/list/?" },
          pagination: { pageCount: 50 },
        },
      });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(remote),
      });

      const config = await loadConfig();

      expect(config.api.endpoints.commentList).toBe("https://www.tiktok.com/api/v2/comment/list/?");
      expect(config.api.endpoints.commentReply).toBe(DEFAULT_CONFIG.api.endpoints.commentReply);
      expect(config.api.pagination.pageCount).toBe(50);
      expect(config.api.pagination.batchSize).toBe(DEFAULT_CONFIG.api.pagination.batchSize);
      expect(config.api.params).toEqual(DEFAULT_CONFIG.api.params);
      expect(config.api.signing).toEqual(DEFAULT_CONFIG.api.signing);
    });

    it("replaces perRequestParams array entirely when overridden", async () => {
      const customParams = ["cursor", "count", "video_id"];
      const remote = makeRemoteConfig({
        api: { perRequestParams: customParams },
      });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(remote),
      });

      const config = await loadConfig();

      expect(config.api.perRequestParams).toEqual(customParams);
    });

    it("preserves all api defaults when api section is missing", async () => {
      const remote = makeRemoteConfig();
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(remote),
      });

      const config = await loadConfig();

      expect(config.api).toEqual(DEFAULT_CONFIG.api);
    });

    it("merges optional features field", async () => {
      const remote = makeRemoteConfig({
        features: { enableReplyDetection: false },
      });
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(remote),
      });

      const config = await loadConfig();

      expect(config.features?.enableReplyDetection).toBe(false);
      expect(config.features?.enableRateLimitAutoResume).toBe(true);
    });
  });
});
