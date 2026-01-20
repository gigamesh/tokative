"use client";

import { useState, useEffect, useCallback } from "react";
import { bridge } from "@/utils/extension-bridge";
import {
  MessageType,
  ScrapedUser,
  MessageTemplate,
  ScrapeProgress,
} from "@/utils/constants";

interface UserDataState {
  users: ScrapedUser[];
  templates: MessageTemplate[];
  accountHandle: string;
  commentLimit: number;
  loading: boolean;
  error: string | null;
  scrapeProgress: ScrapeProgress | null;
  isScrapingActive: boolean;
}

export function useUserData() {
  const [state, setState] = useState<UserDataState>({
    users: [],
    templates: [],
    accountHandle: "",
    commentLimit: 100,
    loading: true,
    error: null,
    scrapeProgress: null,
    isScrapingActive: false,
  });

  const fetchData = useCallback(async () => {
    if (!bridge) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [usersResponse, handleResponse, limitResponse] = await Promise.all([
        bridge.request<{
          users: ScrapedUser[];
          templates: MessageTemplate[];
        }>(MessageType.GET_STORED_USERS),
        bridge.request<{ handle: string | null }>(MessageType.GET_ACCOUNT_HANDLE),
        bridge.request<{ limit: number }>(MessageType.GET_COMMENT_LIMIT),
      ]);

      setState((prev) => ({
        ...prev,
        users: usersResponse.users || [],
        templates: usersResponse.templates || [],
        accountHandle: handleResponse.handle || "",
        commentLimit: limitResponse.limit ?? 100,
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

  useEffect(() => {
    if (!bridge) return;

    fetchData();

    const cleanups = [
      bridge.on(MessageType.SCRAPE_COMMENTS_PROGRESS, (payload) => {
        const progress = payload as ScrapeProgress;
        setState((prev) => ({
          ...prev,
          scrapeProgress: progress,
          isScrapingActive: progress.status !== "complete",
        }));
      }),

      bridge.on(MessageType.SCRAPE_COMMENTS_COMPLETE, () => {
        setState((prev) => ({
          ...prev,
          isScrapingActive: false,
          scrapeProgress: null,
        }));
        fetchData();
      }),

      bridge.on(MessageType.SCRAPE_COMMENTS_ERROR, (payload) => {
        const { error } = payload as { error: string };
        setState((prev) => ({
          ...prev,
          isScrapingActive: false,
          scrapeProgress: null,
          error,
        }));
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [fetchData]);

  const startScraping = useCallback(() => {
    if (!bridge) return;

    setState((prev) => ({
      ...prev,
      isScrapingActive: true,
      scrapeProgress: { current: 0, total: 0, newUsers: 0, status: "scrolling" },
      error: null,
    }));

    bridge.send(MessageType.SCRAPE_COMMENTS_START, {
      handle: state.accountHandle,
      maxComments: state.commentLimit,
    });
  }, [state.accountHandle, state.commentLimit]);

  const saveAccountHandle = useCallback(async (handle: string) => {
    if (!bridge) return;

    const normalized = handle.replace(/^@/, "");
    setState((prev) => ({ ...prev, accountHandle: normalized }));
    bridge.send(MessageType.SAVE_ACCOUNT_HANDLE, { handle: normalized });
  }, []);

  const saveCommentLimit = useCallback(async (limit: number) => {
    if (!bridge) return;

    setState((prev) => ({ ...prev, commentLimit: limit }));
    bridge.send(MessageType.SAVE_COMMENT_LIMIT, { limit });
  }, []);

  const stopScraping = useCallback(() => {
    if (!bridge) return;
    bridge.send(MessageType.SCRAPE_COMMENTS_STOP);
    setState((prev) => ({
      ...prev,
      isScrapingActive: false,
      scrapeProgress: null,
    }));
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
    startScraping,
    stopScraping,
    removeUser,
    removeUsers,
    updateUser,
    saveAccountHandle,
    saveCommentLimit,
  };
}
