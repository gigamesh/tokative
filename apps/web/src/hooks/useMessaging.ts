"use client";

import { useState, useEffect, useCallback } from "react";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, ScrapedUser, ReplyProgress, BulkReplyProgress } from "@/utils/constants";

interface ReplyState {
  isReplying: boolean;
  replyProgress: ReplyProgress | null;
  bulkReplyProgress: BulkReplyProgress | null;
  error: string | null;
}

export function useMessaging() {
  const [state, setState] = useState<ReplyState>({
    isReplying: false,
    replyProgress: null,
    bulkReplyProgress: null,
    error: null,
  });

  useEffect(() => {
    if (!bridge) return;

    const cleanups = [
      bridge.on(MessageType.REPLY_COMMENT_PROGRESS, (payload) => {
        setState((prev) => ({
          ...prev,
          replyProgress: payload as ReplyProgress,
        }));
      }),

      bridge.on(MessageType.REPLY_COMMENT_COMPLETE, () => {
        setState((prev) => ({
          ...prev,
          isReplying: false,
          replyProgress: null,
        }));
      }),

      bridge.on(MessageType.REPLY_COMMENT_ERROR, (payload) => {
        const { error } = payload as { error: string };
        setState((prev) => ({
          ...prev,
          isReplying: false,
          replyProgress: null,
          error,
        }));
      }),

      bridge.on(MessageType.BULK_REPLY_PROGRESS, (payload) => {
        setState((prev) => ({
          ...prev,
          bulkReplyProgress: payload as BulkReplyProgress,
        }));
      }),

      bridge.on(MessageType.BULK_REPLY_COMPLETE, (payload) => {
        setState((prev) => ({
          ...prev,
          isReplying: false,
          bulkReplyProgress: payload as BulkReplyProgress,
        }));
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  const replyToComment = useCallback((user: ScrapedUser, message: string) => {
    if (!bridge) return;

    setState((prev) => ({
      ...prev,
      isReplying: true,
      error: null,
      replyProgress: { userId: user.id, status: "navigating" },
    }));

    bridge.send(MessageType.REPLY_COMMENT, { user, message });
  }, []);

  const startBulkReply = useCallback((userIds: string[], templateId: string) => {
    if (!bridge) return;

    setState((prev) => ({
      ...prev,
      isReplying: true,
      error: null,
      bulkReplyProgress: {
        total: userIds.length,
        completed: 0,
        failed: 0,
        status: "running",
      },
    }));

    bridge.send(MessageType.BULK_REPLY_START, { userIds, templateId });
  }, []);

  const stopBulkReply = useCallback(() => {
    if (!bridge) return;

    bridge.send(MessageType.BULK_REPLY_STOP);
    setState((prev) => ({
      ...prev,
      isReplying: false,
      bulkReplyProgress: prev.bulkReplyProgress
        ? { ...prev.bulkReplyProgress, status: "stopped" }
        : null,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    replyToComment,
    startBulkReply,
    stopBulkReply,
    clearError,
  };
}
