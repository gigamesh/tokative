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
  ignored: number;
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
  pendingVideoIds: string[];
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
    pendingVideoIds: [],
    batchProgress: null,
    scrapingState: null,
    scrapeReport: null,
    isCancelling: false,
  });
  const isProcessingRef = useRef(false);
  const currentFetchingVideoId = useRef<string | null>(null);
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

  const getCommentsForVideos = useCallback(
    (videoIds: string[]) => {
      if (videoIds.length === 0 || !bridge) return;

      if (videoIds.length === 1) {
        startVideoCommentFetch(videoIds[0]);
        return;
      }

      lastBatchProgressRef.current = null;
      setState((prev) => ({
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
      }));

      bridge.send(MessageType.GET_BATCH_COMMENTS, { videoIds });
    },
    [startVideoCommentFetch]
  );

  useEffect(() => {
    if (!bridge) return;

    const cleanups = [
      bridge.on(MessageType.SCRAPE_VIDEOS_COMPLETE, () => {
        // Convex will auto-update via real-time query
      }),

      bridge.on(MessageType.GET_VIDEO_COMMENTS_PROGRESS, (payload) => {
        const progress = payload as GetVideoCommentsProgress;
        setState((prev) => {
          if (prev.isCancelling) return prev;
          const newProgress = new Map(prev.getCommentsProgress);
          newProgress.set(progress.videoId, progress);
          return { ...prev, getCommentsProgress: newProgress };
        });
      }),

      bridge.on(MessageType.GET_VIDEO_COMMENTS_COMPLETE, (payload) => {
        const { videoId } = payload as { videoId: string };
        let wasCancelling = false;
        setState((prev) => {
          if (prev.isCancelling) {
            wasCancelling = true;
            return {
              ...prev,
              batchProgress: null,
              getCommentsProgress: new Map(),
              pendingVideoIds: [],
              scrapingState: null,
              isCancelling: false,
            };
          }
          const newProgress = new Map(prev.getCommentsProgress);
          newProgress.delete(videoId);
          return {
            ...prev,
            getCommentsProgress: newProgress,
            scrapingState: null,
          };
        });
        if (wasCancelling) {
          isProcessingRef.current = false;
          toast("Collecting cancelled.");
          return;
        }
        processNextInQueue();
      }),

      bridge.on(MessageType.GET_VIDEO_COMMENTS_ERROR, (payload) => {
        const { videoId, error, stats } = payload as {
          videoId?: string;
          error: string;
          stats?: ScrapeStats;
        };
        setState((prev) => {
          if (videoId) {
            const newProgress = new Map(prev.getCommentsProgress);
            newProgress.delete(videoId);
            return {
              ...prev,
              getCommentsProgress: newProgress,
              error,
              scrapingState: null,
            };
          }
          return {
            ...prev,
            getCommentsProgress: new Map(),
            pendingVideoIds: [],
            error,
            scrapingState: null,
          };
        });
        console.error("Failed to scrape comments:", error);
        const tabClosed = error?.includes("tab was closed");
        if (stats && stats.new > 0) {
          toast(`Scraping cancelled early. ${stats.new} new comments were saved.`);
        } else if (stats) {
          toast("Scraping cancelled. No new comments were collected.");
        } else if (tabClosed) {
          toast("Scraping cancelled — TikTok tab was closed.");
        } else {
          toast.error("Failed to collect comments. Check console for details.");
        }
        if (videoId) {
          processNextInQueue();
        }
      }),

      bridge.on(MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE, (payload) => {
        const { comments, stats, cancelled, limitReached } = payload as {
          comments: Array<{ videoId?: string }>;
          stats?: ScrapeStats;
          cancelled?: boolean;
          limitReached?: boolean;
        };

        if (cancelled) {
          setState((prev) => ({ ...prev, isCancelling: true }));
          return;
        }

        const videoId =
          comments?.[0]?.videoId || currentFetchingVideoId.current;

        setState((prev) => {
          if (prev.isCancelling) return prev;
          const newProgress = new Map(prev.getCommentsProgress);
          if (videoId) {
            newProgress.delete(videoId);
          }
          return {
            ...prev,
            getCommentsProgress: newProgress,
            scrapingState: null,
            scrapeReport: stats ? { stats, limitReached } : prev.scrapeReport,
          };
        });
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
            batchProgress: progress,
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
        isProcessingRef.current = false;
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
  }, [processNextInQueue]);

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
    pendingVideoIds: state.pendingVideoIds,
    batchProgress: state.batchProgress,
    scrapingState: state.scrapingState,
    scrapeReport: state.scrapeReport,
    isScraping,
    isCancelling: state.isCancelling,
    getCommentsForVideos,
    removeVideos,
    cancelScraping,
    closeScrapeReport,
  };
}
