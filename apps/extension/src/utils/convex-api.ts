import { ScrapedComment, ScrapedVideo, IgnoreListEntry } from "../types";

const CONVEX_HTTP_URL = "CONVEX_SITE_URL_PLACEHOLDER";

const STORAGE_KEYS = {
  AUTH_TOKEN: "tiktok_buddy_auth_token",
} as const;

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

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Not authenticated");
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
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
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
  ignoreList?: string[]
): Promise<ConvexSyncResult> {
  const convexComments = comments.map((c) => ({
    externalId: c.id,
    handle: c.handle,
    comment: c.comment,
    scrapedAt: new Date(c.scrapedAt).getTime(),
    profileUrl: c.profileUrl,
    avatarUrl: c.avatarUrl,
    videoUrl: c.videoUrl,
    commentTimestamp: c.commentTimestamp,
    commentId: c.commentId,
    videoId: c.videoId,
    parentCommentId: c.parentCommentId ?? undefined,
    replyToReplyId: c.replyToReplyId ?? undefined,
    isReply: c.isReply,
    replyCount: c.replyCount,
  }));

  return apiRequest("/api/comments/batch", {
    method: "POST",
    body: JSON.stringify({ comments: convexComments, ignoreList }),
  });
}

export async function fetchComments(): Promise<ScrapedComment[]> {
  const comments = await apiRequest<Array<{
    id: string;
    handle: string;
    comment: string;
    scrapedAt: string;
    profileUrl: string;
    avatarUrl?: string;
    videoUrl?: string;
    replySent?: boolean;
    repliedAt?: string;
    replyError?: string;
    replyContent?: string;
    commentTimestamp?: string;
    commentId?: string;
    videoId?: string;
    parentCommentId?: string;
    replyToReplyId?: string;
    isReply?: boolean;
    replyCount?: number;
  }>>("/api/comments");

  return comments;
}

export async function updateComment(
  externalId: string,
  updates: {
    replySent?: boolean;
    repliedAt?: number;
    replyError?: string;
    replyContent?: string;
  }
): Promise<void> {
  await apiRequest("/api/comments", {
    method: "PUT",
    body: JSON.stringify({ externalId, updates }),
  });
}

export async function deleteComment(externalId: string): Promise<void> {
  await apiRequest("/api/comments", {
    method: "DELETE",
    body: JSON.stringify({ externalId }),
  });
}

export async function deleteComments(externalIds: string[]): Promise<void> {
  await apiRequest("/api/comments", {
    method: "DELETE",
    body: JSON.stringify({ externalIds }),
  });
}

export async function syncVideos(
  videos: ScrapedVideo[]
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
  const videos = await apiRequest<Array<{
    id: string;
    videoId: string;
    thumbnailUrl: string;
    videoUrl: string;
    profileHandle: string;
    order: number;
    scrapedAt: string;
    commentsScraped?: boolean;
  }>>("/api/videos");

  return videos;
}

export async function markVideoCommentsScraped(
  videoId: string,
  commentsScraped: boolean
): Promise<void> {
  await apiRequest("/api/videos/mark-scraped", {
    method: "POST",
    body: JSON.stringify({ videoId, commentsScraped }),
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
  settings: Partial<ConvexSettings>
): Promise<void> {
  await apiRequest("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function isAuthenticated(): Promise<boolean> {
  return getAuthToken().then((token) => !!token);
}
