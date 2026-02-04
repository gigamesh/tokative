import type { ExtensionConfig } from "./types";
import { isVersionCompatible } from "./types";
import { DEFAULT_CONFIG } from "./defaults";

const CONFIG_URL = "https://mmasurka.github.io/tiktok-buddy/config.json";
const CACHE_KEY = "tokative_remote_config";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 5000;

interface CachedConfig {
  config: ExtensionConfig;
  fetchedAt: number;
}

let memoryCache: ExtensionConfig | null = null;

function getExtensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return DEFAULT_CONFIG.version;
  }
}

async function getCachedConfig(): Promise<CachedConfig | null> {
  try {
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cached = result[CACHE_KEY] as CachedConfig | undefined;

    if (cached && cached.config && cached.fetchedAt) {
      const age = Date.now() - cached.fetchedAt;
      if (age < CACHE_TTL_MS) {
        return cached;
      }
    }
  } catch (error) {
    console.warn("[Config] Failed to read cache:", error);
  }
  return null;
}

async function setCachedConfig(config: ExtensionConfig): Promise<void> {
  try {
    const cached: CachedConfig = {
      config,
      fetchedAt: Date.now(),
    };
    await chrome.storage.local.set({ [CACHE_KEY]: cached });
  } catch (error) {
    console.warn("[Config] Failed to write cache:", error);
  }
}

function validateConfig(data: unknown): data is ExtensionConfig {
  if (typeof data !== "object" || data === null) return false;

  const config = data as Record<string, unknown>;

  if (typeof config.version !== "string") return false;
  if (typeof config.minExtensionVersion !== "string") return false;
  if (typeof config.selectors !== "object" || config.selectors === null) return false;
  if (typeof config.timeouts !== "object" || config.timeouts === null) return false;
  if (typeof config.delays !== "object" || config.delays === null) return false;
  if (typeof config.limits !== "object" || config.limits === null) return false;

  return true;
}

function mergeWithDefaults(remote: Partial<ExtensionConfig>): ExtensionConfig {
  return {
    ...DEFAULT_CONFIG,
    ...remote,
    selectors: {
      inbox: { ...DEFAULT_CONFIG.selectors.inbox, ...remote.selectors?.inbox },
      video: { ...DEFAULT_CONFIG.selectors.video, ...remote.selectors?.video },
    },
    timeouts: { ...DEFAULT_CONFIG.timeouts, ...remote.timeouts },
    delays: {
      ...DEFAULT_CONFIG.delays,
      ...remote.delays,
      profiles: { ...DEFAULT_CONFIG.delays.profiles, ...remote.delays?.profiles },
    },
    limits: { ...DEFAULT_CONFIG.limits, ...remote.limits },
    features: { ...DEFAULT_CONFIG.features, ...remote.features },
  };
}

async function fetchExtensionConfig(): Promise<ExtensionConfig | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG_URL, {
      signal: controller.signal,
      cache: "no-cache",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Config] Fetch failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!validateConfig(data)) {
      console.warn("[Config] Invalid config schema");
      return null;
    }

    const extensionVersion = getExtensionVersion();
    if (!isVersionCompatible(data.version, data.minExtensionVersion, extensionVersion)) {
      console.warn(
        `[Config] Version incompatible: config requires extension >= ${data.minExtensionVersion}, ` +
        `current is ${extensionVersion}`
      );
      return null;
    }

    return mergeWithDefaults(data);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("[Config] Fetch timed out");
    } else {
      console.warn("[Config] Fetch error:", error);
    }
    return null;
  }
}

export async function loadConfig(): Promise<ExtensionConfig> {
  if (memoryCache) {
    return memoryCache;
  }

  const cached = await getCachedConfig();
  if (cached) {
    console.log("[Config] Using cached config, version:", cached.config.version);
    memoryCache = cached.config;
    return cached.config;
  }

  const remote = await fetchExtensionConfig();
  if (remote) {
    console.log("[Config] Fetched remote config, version:", remote.version);
    await setCachedConfig(remote);
    memoryCache = remote;
    return remote;
  }

  console.log("[Config] Using default config, version:", DEFAULT_CONFIG.version);
  memoryCache = DEFAULT_CONFIG;
  return DEFAULT_CONFIG;
}

export async function refreshConfig(): Promise<ExtensionConfig> {
  memoryCache = null;
  try {
    await chrome.storage.local.remove(CACHE_KEY);
  } catch {
    // Ignore
  }
  return loadConfig();
}

export function getLoadedConfig(): ExtensionConfig {
  return memoryCache || DEFAULT_CONFIG;
}

export function clearConfigCache(): void {
  memoryCache = null;
}
