"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { bridge } from "@/utils/extension-bridge";
import {
  MessageType,
  ScrapedVideo,
  GetVideoCommentsProgress,
  BatchCommentsProgress,
} from "@/utils/constants";

interface VideoDataState {
  videos: ScrapedVideo[];
  loading: boolean;
  error: string | null;
  getCommentsProgress: Map<string, GetVideoCommentsProgress>;
  pendingVideoIds: string[];
  batchProgress: BatchCommentsProgress | null;
}

export function useVideoData() {
  const [state, setState] = useState<VideoDataState>({
    videos: [],
    loading: true,
    error: null,
    getCommentsProgress: new Map(),
    pendingVideoIds: [],
    batchProgress: null,
  });
  const isProcessingRef = useRef(false);
  const currentFetchingVideoId = useRef<string | null>(null);
  const toastedVideoIds = useRef(new Set<string>());

  const fetchVideos = useCallback(async () => {
    if (!bridge) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await bridge.request<{ videos: ScrapedVideo[] }>(
        MessageType.GET_STORED_VIDEOS
      );

      setState((prev) => ({
        ...prev,
        videos: (response.videos || []).sort((a, b) => a.order - b.order),
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch videos",
      }));
    }
  }, []);

  const startVideoCommentFetch = useCallback((videoId: string) => {
    if (!bridge) return;

    isProcessingRef.current = true;
    currentFetchingVideoId.current = videoId;
    setState((prev) => {
      const newProgress = new Map(prev.getCommentsProgress);
      newProgress.set(videoId, {
        videoId,
        status: "navigating",
        message: "Starting...",
      });
      return { ...prev, getCommentsProgress: newProgress };
    });

    bridge.send(MessageType.GET_VIDEO_COMMENTS, { videoId });
  }, []);

  const processNextInQueue = useCallback(() => {
    setState((prev) => {
      if (prev.pendingVideoIds.length === 0) {
        isProcessingRef.current = false;
        return prev;
      }

      const [nextVideoId, ...remainingIds] = prev.pendingVideoIds;
      setTimeout(() => startVideoCommentFetch(nextVideoId), 500);
      return { ...prev, pendingVideoIds: remainingIds };
    });
  }, [startVideoCommentFetch]);

  const getVideoComments = useCallback((videoId: string) => {
    if (!bridge) return;

    if (isProcessingRef.current) {
      setState((prev) => ({
        ...prev,
        pendingVideoIds: [...prev.pendingVideoIds, videoId],
      }));
    } else {
      startVideoCommentFetch(videoId);
    }
  }, [startVideoCommentFetch]);

  const getCommentsForVideos = useCallback((videoIds: string[]) => {
    if (videoIds.length === 0 || !bridge) return;

    if (videoIds.length === 1) {
      startVideoCommentFetch(videoIds[0]);
      return;
    }

    setState((prev) => ({
      ...prev,
      batchProgress: {
        totalVideos: videoIds.length,
        completedVideos: 0,
        currentVideoId: null,
        totalComments: 0,
        status: "processing",
        message: "Starting batch fetch...",
      },
    }));

    bridge.send(MessageType.GET_BATCH_COMMENTS, { videoIds });
  }, [startVideoCommentFetch]);

  useEffect(() => {
    if (!bridge) return;

    fetchVideos();

    const cleanups = [
      bridge.on(MessageType.SCRAPE_VIDEOS_COMPLETE, () => {
        fetchVideos();
      }),

      bridge.on(MessageType.GET_VIDEO_COMMENTS_PROGRESS, (payload) => {
        const progress = payload as GetVideoCommentsProgress;
        setState((prev) => {
          const newProgress = new Map(prev.getCommentsProgress);
          newProgress.set(progress.videoId, progress);
          return { ...prev, getCommentsProgress: newProgress };
        });
      }),

      bridge.on(MessageType.GET_VIDEO_COMMENTS_COMPLETE, (payload) => {
        const { videoId } = payload as { videoId: string };
        setState((prev) => {
          const newProgress = new Map(prev.getCommentsProgress);
          newProgress.delete(videoId);
          const updatedVideos = prev.videos.map((v) =>
            v.videoId === videoId ? { ...v, commentsScraped: true } : v
          );
          return { ...prev, getCommentsProgress: newProgress, videos: updatedVideos };
        });
        processNextInQueue();
      }),

      bridge.on(MessageType.GET_VIDEO_COMMENTS_ERROR, (payload) => {
        const { videoId, error } = payload as { videoId?: string; error: string };
        setState((prev) => {
          if (videoId) {
            const newProgress = new Map(prev.getCommentsProgress);
            newProgress.delete(videoId);
            return { ...prev, getCommentsProgress: newProgress, error };
          }
          return { ...prev, getCommentsProgress: new Map(), pendingVideoIds: [], error };
        });
        toast.error(`Failed to scrape comments: ${error}`);
        if (videoId) {
          processNextInQueue();
        }
      }),

      bridge.on(MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE, (payload) => {
        const { users } = payload as { users: Array<{ videoId?: string }> };
        const videoId = users[0]?.videoId || currentFetchingVideoId.current;

        if (videoId) {
          setState((prev) => {
            const updatedVideos = prev.videos.map((v) =>
              v.videoId === videoId ? { ...v, commentsScraped: true } : v
            );
            return { ...prev, videos: updatedVideos };
          });

          setState((prev) => {
            if (prev.batchProgress) return prev;
            if (!toastedVideoIds.current.has(videoId)) {
              toastedVideoIds.current.add(videoId);
              toast.success(`Scraped ${users.length} comments`);
              setTimeout(() => toastedVideoIds.current.delete(videoId), 5000);
            }
            return prev;
          });
        }
      }),

      bridge.on(MessageType.GET_BATCH_COMMENTS_PROGRESS, (payload) => {
        const progress = payload as BatchCommentsProgress;
        setState((prev) => {
          if (progress.currentVideoId) {
            const newProgress = new Map(prev.getCommentsProgress);
            newProgress.set(progress.currentVideoId, {
              videoId: progress.currentVideoId,
              status: "scraping",
              message: progress.message,
            });
            return { ...prev, batchProgress: progress, getCommentsProgress: newProgress };
          }
          return { ...prev, batchProgress: progress };
        });
      }),

      bridge.on(MessageType.GET_BATCH_COMMENTS_COMPLETE, (payload) => {
        const { totalVideos, totalComments, videoIds } = payload as {
          totalVideos: number;
          totalComments: number;
          videoIds: string[];
        };
        setState((prev) => {
          const updatedVideos = prev.videos.map((v) =>
            videoIds.includes(v.videoId) ? { ...v, commentsScraped: true } : v
          );
          return { ...prev, batchProgress: null, getCommentsProgress: new Map(), videos: updatedVideos };
        });
        toast.success(`Scraped ${totalComments} comments from ${totalVideos} posts`);
      }),

      bridge.on(MessageType.GET_BATCH_COMMENTS_ERROR, (payload) => {
        const { error, completedVideos, totalComments } = payload as {
          error: string;
          completedVideos?: number;
          totalComments?: number;
        };
        setState((prev) => ({ ...prev, batchProgress: null, getCommentsProgress: new Map(), error }));
        if (completedVideos && completedVideos > 0) {
          toast.error(`Batch failed after ${completedVideos} videos (${totalComments} comments): ${error}`);
        } else {
          toast.error(`Failed to scrape comments: ${error}`);
        }
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [fetchVideos, processNextInQueue]);

  const removeVideo = useCallback(async (videoId: string) => {
    if (!bridge) return;

    bridge.send(MessageType.REMOVE_VIDEO, { videoId });
    setState((prev) => ({
      ...prev,
      videos: prev.videos.filter((v) => v.videoId !== videoId),
    }));
  }, []);

  const removeVideos = useCallback(async (videoIds: string[]) => {
    if (!bridge) return;

    bridge.send(MessageType.REMOVE_VIDEOS, { videoIds });
    setState((prev) => ({
      ...prev,
      videos: prev.videos.filter((v) => !videoIds.includes(v.videoId)),
    }));
  }, []);

  return {
    ...state,
    fetchVideos,
    getVideoComments,
    getCommentsForVideos,
    removeVideo,
    removeVideos,
  };
}
