"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { bridge } from "@/utils/extension-bridge";
import {
  MessageType,
  ScrapedUser,
} from "@/utils/constants";

interface UserDataState {
  users: ScrapedUser[];
  commentLimit: number;
  postLimit: number;
  loading: boolean;
  error: string | null;
}

export function useUserData() {
  const [state, setState] = useState<UserDataState>({
    users: [],
    commentLimit: 100,
    postLimit: 50,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!bridge) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [usersResponse, commentLimitResponse, postLimitResponse] = await Promise.all([
        bridge.request<{
          users: ScrapedUser[];
        }>(MessageType.GET_STORED_USERS),
        bridge.request<{ limit: number }>(MessageType.GET_COMMENT_LIMIT),
        bridge.request<{ limit: number }>(MessageType.GET_POST_LIMIT),
      ]);

      setState((prev) => ({
        ...prev,
        users: usersResponse.users || [],
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

  const removeUser = useCallback(async (userId: string) => {
    if (!bridge) return;

    bridge.send(MessageType.REMOVE_USER, { userId });
    setState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.id !== userId),
    }));
  }, []);

  const removeUsers = useCallback(async (userIds: string[]) => {
    if (!bridge) return;

    bridge.send(MessageType.REMOVE_USERS, { userIds });
    setState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => !userIds.includes(u.id)),
    }));
  }, []);

  const updateUser = useCallback(
    async (userId: string, updates: Partial<ScrapedUser>) => {
      if (!bridge) return;

      bridge.send(MessageType.UPDATE_USER, { userId, updates });
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === userId ? { ...u, ...updates } : u
        ),
      }));
    },
    []
  );

  return {
    ...state,
    fetchData,
    removeUser,
    removeUsers,
    updateUser,
    saveCommentLimit,
    savePostLimit,
  };
}
