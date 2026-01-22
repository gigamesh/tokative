"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { bridge } from "@/utils/extension-bridge";
import {
  MessageType,
  ScrapedVideo,
  GetVideoCommentsProgress,
} from "@/utils/constants";

interface VideoDataState {
  videos: ScrapedVideo[];
  loading: boolean;
  error: string | null;
  getCommentsProgress: Map<string, GetVideoCommentsProgress>;
  pendingVideoIds: string[];
}

export function useVideoData() {
  const [state, setState] = useState<VideoDataState>({
    videos: [],
    loading: true,
    error: null,
    getCommentsProgress: new Map(),
    pendingVideoIds: [],
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
    if (videoIds.length === 0) return;

    const [firstId, ...restIds] = videoIds;
    setState((prev) => ({
      ...prev,
      pendingVideoIds: [...prev.pendingVideoIds, ...restIds],
    }));
    startVideoCommentFetch(firstId);
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
        const { videoId, error } = payload as { videoId: string; error: string };
        setState((prev) => {
          const newProgress = new Map(prev.getCommentsProgress);
          newProgress.delete(videoId);
          return { ...prev, getCommentsProgress: newProgress, error };
        });
        toast.error(`Failed to scrape comments: ${error}`);
        processNextInQueue();
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

          if (!toastedVideoIds.current.has(videoId)) {
            toastedVideoIds.current.add(videoId);
            toast.success(`Scraped ${users.length} comments`);
            setTimeout(() => toastedVideoIds.current.delete(videoId), 5000);
          }
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
