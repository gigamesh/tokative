"use client";

import { useState, useEffect, useCallback } from "react";
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
}

export function useVideoData() {
  const [state, setState] = useState<VideoDataState>({
    videos: [],
    loading: true,
    error: null,
    getCommentsProgress: new Map(),
  });

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
      }),

      bridge.on(MessageType.GET_VIDEO_COMMENTS_ERROR, (payload) => {
        const { videoId, error } = payload as { videoId: string; error: string };
        setState((prev) => {
          const newProgress = new Map(prev.getCommentsProgress);
          newProgress.delete(videoId);
          return { ...prev, getCommentsProgress: newProgress, error };
        });
      }),

      bridge.on(MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE, (payload) => {
        const { users } = payload as { users: Array<{ videoId?: string }> };
        const videoId = users[0]?.videoId;
        if (videoId) {
          setState((prev) => {
            const updatedVideos = prev.videos.map((v) =>
              v.videoId === videoId ? { ...v, commentsScraped: true } : v
            );
            return { ...prev, videos: updatedVideos };
          });
        }
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [fetchVideos]);

  const getVideoComments = useCallback((videoId: string) => {
    if (!bridge) return;

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

  const getCommentsForVideos = useCallback((videoIds: string[]) => {
    videoIds.forEach((videoId) => {
      getVideoComments(videoId);
    });
  }, [getVideoComments]);

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
