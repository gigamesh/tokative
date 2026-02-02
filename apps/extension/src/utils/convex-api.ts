import {
  IgnoreListEntry,
  MessageType,
  ScrapedComment,
  ScrapedVideo,
} from "../types";

declare const CONVEX_SITE_URL_PLACEHOLDER: string;
const CONVEX_HTTP_URL = CONVEX_SITE_URL_PLACEHOLDER;

const STORAGE_KEYS = {
  AUTH_TOKEN: "tokative_auth_token",
} as const;

let tokenRequestInProgress: Promise<string | null> | null = null;

export interface ConvexSyncResult {
  stored: number;
  duplicates: number;
  ignored: number;
}

export interface ConvexSettings {
  messageDelay: number;
  scrollDelay: number;
  commentLimit: number;
  postLimit: number;
  accountHandle: string | null;
}

export async function getAuthToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH_TOKEN);
  return result[STORAGE_KEYS.AUTH_TOKEN] || null;
}

export async function setAuthToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_TOKEN]: token });
}

export async function clearAuthToken(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.AUTH_TOKEN);
}

export async function requestAuthTokenFromWebApp(
  timeoutMs = 5000,
): Promise<string | null> {
  // Prevent concurrent token requests
  if (tokenRequestInProgress) {
    return tokenRequestInProgress;
  }

  tokenRequestInProgress = (async () => {
    try {
      // First check if we already have a token
      const existingToken = await getAuthToken();
      if (existingToken) {
        return existingToken;
      }

      // Request token from web app via background script
      return new Promise<string | null>((resolve) => {
        const timeoutId = setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener);
          console.log("[ConvexAPI] Token request timed out");
          resolve(null);
        }, timeoutMs);

        const listener = (message: {
          type: string;
          payload?: { token?: string | null };
        }) => {
          if (message.type === MessageType.AUTH_TOKEN_RESPONSE) {
            clearTimeout(timeoutId);
            chrome.runtime.onMessage.removeListener(listener);
            const token = message.payload?.token || null;
            if (token) {
              setAuthToken(token);
            }
            resolve(token);
          }
        };

        chrome.runtime.onMessage.addListener(listener);

        // Send request to background, which will forward to dashboard tabs
        chrome.runtime
          .sendMessage({ type: MessageType.GET_AUTH_TOKEN })
          .catch(() => {
            clearTimeout(timeoutId);
            chrome.runtime.onMessage.removeListener(listener);
            resolve(null);
          });
      });
    } finally {
      tokenRequestInProgress = null;
    }
  })();

  return tokenRequestInProgress;
}

async function getOrRequestAuthToken(): Promise<string | null> {
  const token = await getAuthToken();
  if (token) {
    return token;
  }
  return requestAuthTokenFromWebApp();
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getOrRequestAuthToken();

  if (!token) {
    throw new Error(
      "Not authenticated - please sign in to the Tokative web app",
    );
  }

  const response = await fetch(`${CONVEX_HTTP_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function ensureUser(email?: string): Promise<{ userId: string }> {
  return apiRequest("/api/users/ensure", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function syncComments(
  comments: ScrapedComment[],
  ignoreList?: string[],
): Promise<ConvexSyncResult> {
  const convexComments = comments.map((c) => ({
    commentId: c.commentId,
    tiktokUserId: c.tiktokUserId,
    handle: c.handle,
    comment: c.comment,
    scrapedAt: new Date(c.scrapedAt).getTime(),
    profileUrl: c.profileUrl,
    avatarUrl: c.avatarUrl,
    videoUrl: c.videoUrl,
    commentTimestamp: c.commentTimestamp,
    videoId: c.videoId,
    parentCommentId: c.parentCommentId ?? undefined,
    isReply: c.isReply,
    replyCount: c.replyCount,
    source: c.source,
  }));

  return apiRequest("/api/comments/batch", {
    method: "POST",
    body: JSON.stringify({ comments: convexComments, ignoreList }),
  });
}

export async function fetchComments(): Promise<ScrapedComment[]> {
  const comments = await apiRequest<ScrapedComment[]>("/api/comments");
  return comments;
}

export async function updateComment(
  commentId: string,
  updates: {
    replySent?: boolean;
    repliedAt?: number;
    replyError?: string;
    replyContent?: string;
  },
): Promise<void> {
  await apiRequest("/api/comments", {
    method: "PUT",
    body: JSON.stringify({ commentId, updates }),
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiRequest("/api/comments", {
    method: "DELETE",
    body: JSON.stringify({ commentId }),
  });
}

export async function deleteComments(commentIds: string[]): Promise<void> {
  await apiRequest("/api/comments", {
    method: "DELETE",
    body: JSON.stringify({ commentIds }),
  });
}

export async function syncVideos(
  videos: ScrapedVideo[],
): Promise<{ stored: number; duplicates: number }> {
  const convexVideos = videos.map((v) => ({
    videoId: v.videoId,
    thumbnailUrl: v.thumbnailUrl,
    videoUrl: v.videoUrl,
    profileHandle: v.profileHandle,
    order: v.order,
    scrapedAt: new Date(v.scrapedAt).getTime(),
    commentsScraped: v.commentsScraped,
  }));

  return apiRequest("/api/videos/batch", {
    method: "POST",
    body: JSON.stringify({ videos: convexVideos }),
  });
}

export async function fetchVideos(): Promise<ScrapedVideo[]> {
  const videos = await apiRequest<
    Array<{
      id: string;
      videoId: string;
      thumbnailUrl: string;
      videoUrl: string;
      profileHandle: string;
      order: number;
      scrapedAt: string;
      commentsScraped?: boolean;
    }>
  >("/api/videos");

  return videos;
}

export async function updateVideo(
  videoId: string,
  updates: { commentsScraped?: boolean },
): Promise<void> {
  await apiRequest("/api/videos", {
    method: "PUT",
    body: JSON.stringify({ videoId, updates }),
  });
}

export async function deleteVideo(videoId: string): Promise<void> {
  await apiRequest("/api/videos", {
    method: "DELETE",
    body: JSON.stringify({ videoId }),
  });
}

export async function deleteVideos(videoIds: string[]): Promise<void> {
  await apiRequest("/api/videos", {
    method: "DELETE",
    body: JSON.stringify({ videoIds }),
  });
}

export async function fetchIgnoreList(): Promise<IgnoreListEntry[]> {
  return apiRequest("/api/ignore-list");
}

export async function addToIgnoreListRemote(text: string): Promise<void> {
  await apiRequest("/api/ignore-list", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function removeFromIgnoreListRemote(text: string): Promise<void> {
  await apiRequest("/api/ignore-list", {
    method: "DELETE",
    body: JSON.stringify({ text }),
  });
}

export async function fetchSettings(): Promise<ConvexSettings> {
  return apiRequest("/api/settings");
}

export async function updateSettings(
  settings: Partial<ConvexSettings>,
): Promise<void> {
  await apiRequest("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function isAuthenticated(): Promise<boolean> {
  return getAuthToken().then((token) => !!token);
}

export interface ScrapingContext {
  ignoreList: string[];
  existingCommentIds: string[];
}

export async function fetchScrapingContext(): Promise<ScrapingContext> {
  return apiRequest("/api/scraping/context");
}
