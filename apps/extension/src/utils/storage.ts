import {
  ScrapedComment,
  ScrapedVideo,
  StorageData,
  CommentScrapingState,
  DEFAULT_SETTINGS,
  IgnoreListEntry,
} from "../types";

const STORAGE_KEYS = {
  SCRAPED_COMMENTS: "tiktok_buddy_scraped_comments",
  VIDEOS: "tiktok_buddy_videos",
  SETTINGS: "tiktok_buddy_settings",
  ACCOUNT_HANDLE: "tiktok_buddy_account_handle",
  COMMENT_LIMIT: "tiktok_buddy_comment_limit",
  POST_LIMIT: "tiktok_buddy_post_limit",
  SCRAPING_STATE: "tiktok_buddy_scraping_state",
  IGNORE_LIST: "tiktok_buddy_ignore_list",
} as const;

const DEFAULT_COMMENT_LIMIT = 100;
const DEFAULT_POST_LIMIT = 50;

export async function getScrapedComments(): Promise<ScrapedComment[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SCRAPED_COMMENTS);
  return result[STORAGE_KEYS.SCRAPED_COMMENTS] || [];
}

export async function saveScrapedComments(comments: ScrapedComment[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SCRAPED_COMMENTS]: comments });
}

export async function addScrapedComments(newComments: ScrapedComment[]): Promise<number> {
  const existing = await getScrapedComments();
  const ignoreList = await getIgnoreList();
  const ignoredTexts = new Set(ignoreList.map((entry) => entry.text));

  const existingIds = new Set(existing.map((c) => c.id));
  const existingKeys = new Set(existing.map((c) => `${c.handle}:${c.comment}`));

  const uniqueNew = newComments.filter((c) => {
    if (ignoredTexts.has(c.comment)) {
      return false;
    }
    const key = `${c.handle}:${c.comment}`;
    return !existingIds.has(c.id) && !existingKeys.has(key);
  });

  if (uniqueNew.length > 0) {
    await saveScrapedComments([...existing, ...uniqueNew]);
  }

  return uniqueNew.length;
}

export async function updateScrapedComment(
  commentId: string,
  updates: Partial<ScrapedComment>
): Promise<void> {
  const comments = await getScrapedComments();
  const index = comments.findIndex((c) => c.id === commentId);

  if (index !== -1) {
    comments[index] = { ...comments[index], ...updates };
    await saveScrapedComments(comments);
  }
}

export async function removeScrapedComment(commentId: string): Promise<void> {
  const comments = await getScrapedComments();
  await saveScrapedComments(comments.filter((c) => c.id !== commentId));
}

export async function removeScrapedComments(commentIds: string[]): Promise<void> {
  const comments = await getScrapedComments();
  const idsToRemove = new Set(commentIds);
  await saveScrapedComments(comments.filter((c) => !idsToRemove.has(c.id)));
}

export async function getSettings(): Promise<StorageData["settings"]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
}

export async function saveSettings(
  settings: StorageData["settings"]
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

export async function getAllData(): Promise<StorageData> {
  const [comments, settings] = await Promise.all([
    getScrapedComments(),
    getSettings(),
  ]);

  return { comments, settings };
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.remove([
    STORAGE_KEYS.SCRAPED_COMMENTS,
    STORAGE_KEYS.SETTINGS,
  ]);
}

export async function getAccountHandle(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACCOUNT_HANDLE);
  return result[STORAGE_KEYS.ACCOUNT_HANDLE] || null;
}

export async function saveAccountHandle(handle: string): Promise<void> {
  const normalized = handle.replace(/^@/, "");
  await chrome.storage.local.set({ [STORAGE_KEYS.ACCOUNT_HANDLE]: normalized });
}

export async function getCommentLimit(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.COMMENT_LIMIT);
  return result[STORAGE_KEYS.COMMENT_LIMIT] ?? DEFAULT_COMMENT_LIMIT;
}

export async function saveCommentLimit(limit: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.COMMENT_LIMIT]: limit });
}

export async function getPostLimit(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.POST_LIMIT);
  return result[STORAGE_KEYS.POST_LIMIT] ?? DEFAULT_POST_LIMIT;
}

export async function savePostLimit(limit: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.POST_LIMIT]: limit });
}

export async function getVideos(): Promise<ScrapedVideo[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.VIDEOS);
  return result[STORAGE_KEYS.VIDEOS] || [];
}

export async function saveVideos(videos: ScrapedVideo[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.VIDEOS]: videos });
}

export async function addVideos(newVideos: ScrapedVideo[]): Promise<number> {
  const existing = await getVideos();
  const existingIds = new Set(existing.map((v) => v.videoId));

  const uniqueNew = newVideos.filter((v) => !existingIds.has(v.videoId));

  if (uniqueNew.length > 0) {
    await saveVideos([...existing, ...uniqueNew]);
  }

  return uniqueNew.length;
}

export async function updateVideo(
  videoId: string,
  updates: Partial<ScrapedVideo>
): Promise<void> {
  const videos = await getVideos();
  const index = videos.findIndex((v) => v.videoId === videoId);

  if (index !== -1) {
    videos[index] = { ...videos[index], ...updates };
    await saveVideos(videos);
  }
}

export async function removeVideo(videoId: string): Promise<void> {
  const videos = await getVideos();
  await saveVideos(videos.filter((v) => v.videoId !== videoId));
}

export async function removeVideos(videoIds: string[]): Promise<void> {
  const videos = await getVideos();
  const idsToRemove = new Set(videoIds);
  await saveVideos(videos.filter((v) => !idsToRemove.has(v.videoId)));
}

export async function clearVideos(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.VIDEOS);
}

const DEFAULT_SCRAPING_STATE: CommentScrapingState = {
  isActive: false,
  isPaused: false,
  videoId: null,
  tabId: null,
  commentsFound: 0,
  status: "complete",
  message: "",
};

export async function getScrapingState(): Promise<CommentScrapingState> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SCRAPING_STATE);
  return result[STORAGE_KEYS.SCRAPING_STATE] || DEFAULT_SCRAPING_STATE;
}

export async function saveScrapingState(state: Partial<CommentScrapingState>): Promise<void> {
  const current = await getScrapingState();
  await chrome.storage.local.set({
    [STORAGE_KEYS.SCRAPING_STATE]: { ...current, ...state },
  });
}

export async function clearScrapingState(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SCRAPING_STATE]: DEFAULT_SCRAPING_STATE,
  });
}

export async function getIgnoreList(): Promise<IgnoreListEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.IGNORE_LIST);
  return result[STORAGE_KEYS.IGNORE_LIST] || [];
}

export async function addToIgnoreList(text: string): Promise<void> {
  const existing = await getIgnoreList();
  const alreadyExists = existing.some((entry) => entry.text === text);
  if (alreadyExists) {
    return;
  }
  const newEntry: IgnoreListEntry = {
    text,
    addedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({
    [STORAGE_KEYS.IGNORE_LIST]: [...existing, newEntry],
  });
}

export async function removeFromIgnoreList(text: string): Promise<void> {
  const existing = await getIgnoreList();
  const filtered = existing.filter((entry) => entry.text !== text);
  await chrome.storage.local.set({
    [STORAGE_KEYS.IGNORE_LIST]: filtered,
  });
}
