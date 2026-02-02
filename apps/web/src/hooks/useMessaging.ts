"use client";

import { useState, useEffect, useCallback } from "react";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, ScrapedComment, ReplyProgress, BulkReplyProgress } from "@/utils/constants";

interface ReplyState {
  isReplying: boolean;
  replyProgress: ReplyProgress | null;
  bulkReplyProgress: BulkReplyProgress | null;
  error: string | null;
}

interface UseMessagingOptions {
  onReplyComplete?: (commentId: string) => void;
  onPostedReply?: (reply: ScrapedComment) => void;
}

export function useMessaging(options: UseMessagingOptions = {}) {
  const { onReplyComplete, onPostedReply } = options;
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

      bridge.on(MessageType.REPLY_COMMENT_COMPLETE, (payload) => {
        const { commentId, postedReply } = payload as {
          commentId: string;
          postedReply?: ScrapedComment;
        };
        if (commentId && onReplyComplete) {
          onReplyComplete(commentId);
        }
        if (postedReply && onPostedReply) {
          onPostedReply(postedReply);
        }
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
  }, [onReplyComplete, onPostedReply]);

  const replyToComment = useCallback((comment: ScrapedComment, message: string) => {
    if (!bridge) return;

    setState((prev) => ({
      ...prev,
      isReplying: true,
      error: null,
      replyProgress: { commentId: comment.id, status: "navigating" },
    }));

    bridge.send(MessageType.REPLY_COMMENT, { comment, message });
  }, []);

  const startBulkReply = useCallback((commentIds: string[], messages: string[]) => {
    if (!bridge) return;

    setState((prev) => ({
      ...prev,
      isReplying: true,
      error: null,
      bulkReplyProgress: {
        total: commentIds.length,
        completed: 0,
        failed: 0,
        status: "running",
      },
    }));

    bridge.send(MessageType.BULK_REPLY_START, { commentIds, messages });
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
