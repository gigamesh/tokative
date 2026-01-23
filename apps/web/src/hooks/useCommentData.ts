"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { bridge } from "@/utils/extension-bridge";
import {
  MessageType,
  ScrapedComment,
} from "@/utils/constants";

interface CommentDataState {
  comments: ScrapedComment[];
  commentLimit: number;
  postLimit: number;
  loading: boolean;
  error: string | null;
}

export function useCommentData() {
  const [state, setState] = useState<CommentDataState>({
    comments: [],
    commentLimit: 100,
    postLimit: 50,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!bridge) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [commentsResponse, commentLimitResponse, postLimitResponse] = await Promise.all([
        bridge.request<{
          comments: ScrapedComment[];
        }>(MessageType.GET_SCRAPED_COMMENTS),
        bridge.request<{ limit: number }>(MessageType.GET_COMMENT_LIMIT),
        bridge.request<{ limit: number }>(MessageType.GET_POST_LIMIT),
      ]);

      setState((prev) => ({
        ...prev,
        comments: commentsResponse.comments || [],
        commentLimit: commentLimitResponse.limit ?? 100,
        postLimit: postLimitResponse.limit ?? 50,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to fetch data",
      }));
    }
  }, []);

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommentsCountRef = useRef<number>(0);

  const debouncedFetchData = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      fetchData();
    }, 250);
  }, [fetchData]);

  useEffect(() => {
    if (!bridge) return;
    fetchData();

    const cleanups = [
      bridge.on(MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE, () => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        fetchData();
      }),

      bridge.on(MessageType.SCRAPE_VIDEO_COMMENTS_PROGRESS, (payload) => {
        const progress = payload as { commentsFound?: number; status?: string };
        if (progress.status === "scraping" && progress.commentsFound !== undefined) {
          if (progress.commentsFound > lastCommentsCountRef.current) {
            lastCommentsCountRef.current = progress.commentsFound;
            debouncedFetchData();
          }
        }
      }),

      bridge.on(MessageType.GET_VIDEO_COMMENTS_PROGRESS, (payload) => {
        const progress = payload as { commentsFound?: number; status?: string };
        if (progress.commentsFound !== undefined && progress.commentsFound > lastCommentsCountRef.current) {
          lastCommentsCountRef.current = progress.commentsFound;
          debouncedFetchData();
        }
      }),

      bridge.on(MessageType.GET_BATCH_COMMENTS_PROGRESS, (payload) => {
        const progress = payload as { totalComments?: number };
        if (progress.totalComments !== undefined && progress.totalComments > lastCommentsCountRef.current) {
          lastCommentsCountRef.current = progress.totalComments;
          debouncedFetchData();
        }
      }),

      bridge.on(MessageType.GET_BATCH_COMMENTS_COMPLETE, () => {
        lastCommentsCountRef.current = 0;
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        fetchData();
      }),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchData, debouncedFetchData]);

  const saveCommentLimit = useCallback(async (limit: number) => {
    if (!bridge) return;

    setState((prev) => ({ ...prev, commentLimit: limit }));
    bridge.send(MessageType.SAVE_COMMENT_LIMIT, { limit });
  }, []);

  const savePostLimit = useCallback(async (limit: number) => {
    if (!bridge) return;

    setState((prev) => ({ ...prev, postLimit: limit }));
    bridge.send(MessageType.SAVE_POST_LIMIT, { limit });
  }, []);

  const removeComment = useCallback(async (commentId: string) => {
    if (!bridge) return;

    bridge.send(MessageType.REMOVE_SCRAPED_COMMENT, { commentId });
    setState((prev) => ({
      ...prev,
      comments: prev.comments.filter((c) => c.id !== commentId),
    }));
  }, []);

  const removeComments = useCallback(async (commentIds: string[]) => {
    if (!bridge) return;

    bridge.send(MessageType.REMOVE_SCRAPED_COMMENTS, { commentIds });
    setState((prev) => ({
      ...prev,
      comments: prev.comments.filter((c) => !commentIds.includes(c.id)),
    }));
  }, []);

  const updateComment = useCallback(
    async (commentId: string, updates: Partial<ScrapedComment>) => {
      if (!bridge) return;

      bridge.send(MessageType.UPDATE_SCRAPED_COMMENT, { commentId, updates });
      setState((prev) => ({
        ...prev,
        comments: prev.comments.map((c) =>
          c.id === commentId ? { ...c, ...updates } : c
        ),
      }));
    },
    []
  );

  return {
    ...state,
    fetchData,
    removeComment,
    removeComments,
    updateComment,
    saveCommentLimit,
    savePostLimit,
  };
}
