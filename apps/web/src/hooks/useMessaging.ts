"use client";

import { useState, useEffect, useCallback } from "react";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, ScrapedComment, ReplyProgress, BulkReplyProgress } from "@/utils/constants";

interface ReplyState {
  isReplying: boolean;
  replyProgress: ReplyProgress | null;
  bulkReplyProgress: BulkReplyProgress | null;
  isSingleReply: boolean;
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
    isSingleReply: false,
    error: null,
  });

  useEffect(() => {
    if (!bridge) return;

    const cleanups = [
      bridge.on(MessageType.REPLY_COMMENT_PROGRESS, (payload) => {
        setState((prev) => {
          if (prev.bulkReplyProgress && prev.bulkReplyProgress.total > 1) return prev;
          return {
            ...prev,
            replyProgress: payload as ReplyProgress,
          };
        });
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
        setState((prev) => {
          if (prev.bulkReplyProgress && prev.bulkReplyProgress.total > 1) return prev;
          return {
            ...prev,
            replyProgress: null,
            bulkReplyProgress: prev.bulkReplyProgress
              ? { ...prev.bulkReplyProgress, completed: 1, status: "complete" }
              : null,
          };
        });
        setTimeout(() => {
          setState((prev) => {
            if (prev.bulkReplyProgress && prev.bulkReplyProgress.total > 1) return prev;
            return {
              ...prev,
              isReplying: false,
              replyProgress: null,
              bulkReplyProgress: null,
            };
          });
        }, 1500);
      }),

      bridge.on(MessageType.REPLY_COMMENT_ERROR, (payload) => {
        const { error } = payload as { error: string };
        setState((prev) => {
          if (prev.bulkReplyProgress && prev.bulkReplyProgress.total > 1) return prev;
          return {
            ...prev,
            replyProgress: null,
            bulkReplyProgress: prev.bulkReplyProgress
              ? { ...prev.bulkReplyProgress, failed: 1, status: "complete" }
              : null,
            error,
          };
        });
        setTimeout(() => {
          setState((prev) => {
            if (prev.bulkReplyProgress && prev.bulkReplyProgress.total > 1) return prev;
            return {
              ...prev,
              isReplying: false,
              bulkReplyProgress: null,
            };
          });
        }, 1500);
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
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            bulkReplyProgress: null,
          }));
        }, 1500);
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [onReplyComplete, onPostedReply]);

  const replyToComment = useCallback((comment: ScrapedComment, message: string) => {
    if (!bridge) return;

    setState((prev) => ({
      ...prev,
      isReplying: true,
      isSingleReply: true,
      error: null,
      replyProgress: { commentId: comment.id, status: "navigating" },
      bulkReplyProgress: {
        total: 1,
        completed: 0,
        failed: 0,
        skipped: 0,
        status: "running",
        current: comment.handle,
      },
    }));

    bridge.send(MessageType.REPLY_COMMENT, { comment, message });
  }, []);

  const startBulkReply = useCallback((commentIds: string[], messages: string[], deleteMissingComments: boolean) => {
    if (!bridge) return;

    setState((prev) => ({
      ...prev,
      isReplying: true,
      isSingleReply: false,
      error: null,
      bulkReplyProgress: {
        total: commentIds.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        status: "running",
      },
    }));

    bridge.send(MessageType.BULK_REPLY_START, { commentIds, messages, deleteMissingComments });
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
