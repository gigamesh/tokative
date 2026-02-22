"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@/providers/ConvexProvider";
import { toast } from "sonner";
import { api } from "@tokative/convex";
import { bridge } from "@/utils/extension-bridge";
import {
  MessageType,
  ScrapedVideo,
  GetVideoCommentsProgress,
  BatchCommentsProgress,
  ScrapingState,
} from "@/utils/constants";

interface ScrapeStats {
  found: number;
  new: number;
  preexisting: number;
}

interface ScrapeReport {
  stats: ScrapeStats;
  limitReached?: boolean;
}

interface VideoDataState {
  loading: boolean;
  error: string | null;
  getCommentsProgress: Map<string, GetVideoCommentsProgress>;
  batchProgress: BatchCommentsProgress | null;
  scrapingState: ScrapingState | null;
  scrapeReport: ScrapeReport | null;
  isCancelling: boolean;
}

export function useVideoData() {
  const { userId } = useAuth();
  const [state, setState] = useState<VideoDataState>({
    loading: true,
    error: null,
    getCommentsProgress: new Map(),
    batchProgress: null,
    scrapingState: null,
    scrapeReport: null,
    isCancelling: false,
  });
  const lastBatchProgressRef = useRef<{ completedVideos: number; totalComments: number } | null>(null);

  const videosQuery = useQuery(
    api.videos.list,
    userId ? { clerkId: userId } : "skip"
  );
  const removeVideosMutation = useMutation(api.videos.removeBatch);

  const videos = (videosQuery ?? []) as ScrapedVideo[];


  useEffect(() => {
    if (videosQuery !== undefined) {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [videosQuery]);

  const getCommentsForVideos = useCallback(
    (videoIds: string[]) => {
      if (videoIds.length === 0 || !bridge) return;

      lastBatchProgressRef.current = null;
      setState((prev) => {
        const newProgress = new Map(prev.getCommentsProgress);
        for (const id of videoIds) {
          newProgress.set(id, {
            videoId: id,
            status: "navigating",
            message: "Queued...",
          });
        }
        return {
          ...prev,
          batchProgress: {
            totalVideos: videoIds.length,
            completedVideos: 0,
            currentVideoIndex: 0,
            currentVideoId: null,
            totalComments: 0,
            status: "processing",
            message: "Starting batch fetch...",
          },
          getCommentsProgress: newProgress,
        };
      });

      bridge.send(MessageType.GET_BATCH_COMMENTS, { videoIds });
    },
    []
  );

  useEffect(() => {
    if (!bridge) return;

    const cleanups = [
      bridge.on(MessageType.SCRAPE_VIDEOS_COMPLETE, () => {
        // Convex will auto-update via real-time query
      }),

      bridge.on(MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE, (payload) => {
        const { cancelled } = payload as { cancelled?: boolean };
        if (cancelled) {
          setState((prev) => ({ ...prev, isCancelling: true }));
        }
      }),

      bridge.on(MessageType.GET_BATCH_COMMENTS_PROGRESS, (payload) => {
        const progress = payload as BatchCommentsProgress;
        lastBatchProgressRef.current = {
          completedVideos: progress.completedVideos,
          totalComments: progress.totalComments,
        };
        setState((prev) => {
          if (prev.isCancelling) return prev;
          const newProgress = new Map(prev.getCommentsProgress);

          Array.from(newProgress.entries()).forEach(
            ([videoId, videoProgress]) => {
              if (
                videoProgress.status === "scraping" &&
                videoId !== progress.currentVideoId
              ) {
                newProgress.set(videoId, {
                  ...videoProgress,
                  status: "complete",
                });
              }
            }
          );

          if (progress.currentVideoId) {
            newProgress.set(progress.currentVideoId, {
              videoId: progress.currentVideoId,
              status: "scraping",
              message: progress.message,
              stats: progress.currentVideoStats,
            });
          }

          return {
            ...prev,
            batchProgress: {
              ...progress,
              totalVideos: Math.max(prev.batchProgress?.totalVideos ?? 0, progress.totalVideos),
            },
            getCommentsProgress: newProgress,
          };
        });
      }),

      bridge.on(MessageType.SCRAPE_PAUSED, (payload) => {
        const scrapingState = payload as ScrapingState;
        setState((prev) => ({ ...prev, scrapingState }));
      }),

      bridge.on(MessageType.GET_BATCH_COMMENTS_COMPLETE, (payload) => {
        const { stats, limitReached } = payload as {
          totalVideos: number;
          totalComments: number;
          videoIds: string[];
          stats?: ScrapeStats;
          limitReached?: boolean;
        };
        setState((prev) => {
          return {
            ...prev,
            batchProgress: null,
            getCommentsProgress: new Map(),
            scrapingState: null,
            scrapeReport: stats ? { stats, limitReached } : null,
          };
        });
      }),

      bridge.on(MessageType.GET_BATCH_COMMENTS_ERROR, (payload) => {
        const { error, completedVideos, totalComments, stats } = payload as {
          error: string;
          completedVideos?: number;
          totalComments?: number;
          stats?: ScrapeStats;
        };
        let wasCancelling = false;
        setState((prev) => {
          wasCancelling = prev.isCancelling;
          return {
            ...prev,
            batchProgress: null,
            getCommentsProgress: new Map(),
            error: wasCancelling ? prev.error : error,
            scrapingState: null,
            isCancelling: false,
          };
        });
        if (wasCancelling) {
          const savedProgress = lastBatchProgressRef.current;
          lastBatchProgressRef.current = null;
          if (stats && stats.new > 0) {
            toast(`Collecting cancelled — ${stats.new} new comments saved across ${completedVideos ?? savedProgress?.completedVideos ?? 0} videos.`);
          } else if ((completedVideos ?? savedProgress?.completedVideos ?? 0) > 0) {
            toast(`Collecting cancelled — ${totalComments ?? savedProgress?.totalComments ?? 0} comments processed across ${completedVideos ?? savedProgress?.completedVideos ?? 0} videos.`);
          } else {
            toast("Collecting cancelled. No new comments were collected.");
          }
        } else {
          console.error("Batch scrape failed:", error);
          if (completedVideos && completedVideos > 0) {
            toast.error(
              `Batch failed after ${completedVideos} videos (${totalComments} comments). Check console for details.`
            );
          } else {
            toast.error("Failed to collect comments. Check console for details.");
          }
        }
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  const removeVideos = useCallback(
    async (videoIds: string[]) => {
      if (!userId) return;

      await removeVideosMutation({
        clerkId: userId,
        videoIds,
      });

      if (bridge) {
        bridge.send(MessageType.REMOVE_VIDEOS, { videoIds });
      }
    },
    [userId, removeVideosMutation]
  );

  const addToBatch = useCallback(
    (videoIds: string[]) => {
      if (videoIds.length === 0 || !bridge || !state.batchProgress) return;

      const alreadyInBatch = new Set(
        Array.from(state.getCommentsProgress.keys()),
      );
      const newIds = videoIds.filter((id) => !alreadyInBatch.has(id));
      if (newIds.length === 0) return;

      setState((prev) => {
        if (!prev.batchProgress) return prev;
        const newProgress = new Map(prev.getCommentsProgress);
        for (const id of newIds) {
          newProgress.set(id, {
            videoId: id,
            status: "navigating",
            message: "Queued...",
          });
        }
        return {
          ...prev,
          batchProgress: {
            ...prev.batchProgress,
            totalVideos: prev.batchProgress.totalVideos + newIds.length,
          },
          getCommentsProgress: newProgress,
        };
      });

      bridge.send(MessageType.ADD_BATCH_VIDEOS, { videoIds: newIds });
    },
    [state.batchProgress, state.getCommentsProgress],
  );

  const removeFromBatch = useCallback(
    (videoIds: string[]) => {
      if (videoIds.length === 0 || !bridge || !state.batchProgress) return;

      const removable = videoIds.filter((id) => {
        const progress = state.getCommentsProgress.get(id);
        return !progress || progress.status === "navigating";
      });
      if (removable.length === 0) return;

      setState((prev) => {
        if (!prev.batchProgress) return prev;
        const newProgress = new Map(prev.getCommentsProgress);
        for (const id of removable) {
          newProgress.delete(id);
        }
        return {
          ...prev,
          batchProgress: {
            ...prev.batchProgress,
            totalVideos: Math.max(0, prev.batchProgress.totalVideos - removable.length),
          },
          getCommentsProgress: newProgress,
        };
      });

      bridge.send(MessageType.REMOVE_BATCH_VIDEOS, { videoIds: removable });
    },
    [state.batchProgress, state.getCommentsProgress],
  );

  const cancelScraping = useCallback(() => {
    if (!bridge) return;

    bridge.send(MessageType.SCRAPE_VIDEO_COMMENTS_STOP, {});
    setState((prev) => ({
      ...prev,
      isCancelling: true,
    }));
  }, []);

  const closeScrapeReport = useCallback(() => {
    setState((prev) => ({ ...prev, scrapeReport: null }));
  }, []);

  const isScraping =
    state.batchProgress !== null || state.getCommentsProgress.size > 0 || state.isCancelling;

  return {
    videos,
    loading: state.loading || videosQuery === undefined,
    error: state.error,
    getCommentsProgress: state.getCommentsProgress,
    batchProgress: state.batchProgress,
    scrapingState: state.scrapingState,
    scrapeReport: state.scrapeReport,
    isScraping,
    isCancelling: state.isCancelling,
    getCommentsForVideos,
    addToBatch,
    removeFromBatch,
    removeVideos,
    cancelScraping,
    closeScrapeReport,
  };
}
