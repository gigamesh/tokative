"use client";

import { useState, useEffect, useCallback } from "react";
import { bridge } from "@/utils/extension-bridge";
import {
  MessageType,
  ScrapedUser,
  MessageTemplate,
} from "@/utils/constants";

interface UserDataState {
  users: ScrapedUser[];
  templates: MessageTemplate[];
  commentLimit: number;
  postLimit: number;
  loading: boolean;
  error: string | null;
}

export function useUserData() {
  const [state, setState] = useState<UserDataState>({
    users: [],
    templates: [],
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
          templates: MessageTemplate[];
        }>(MessageType.GET_STORED_USERS),
        bridge.request<{ limit: number }>(MessageType.GET_COMMENT_LIMIT),
        bridge.request<{ limit: number }>(MessageType.GET_POST_LIMIT),
      ]);

      setState((prev) => ({
        ...prev,
        users: usersResponse.users || [],
        templates: usersResponse.templates || [],
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

  useEffect(() => {
    if (!bridge) return;
    fetchData();
  }, [fetchData]);

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
