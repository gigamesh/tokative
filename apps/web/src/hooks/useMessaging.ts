"use client";

import { useState, useEffect, useCallback } from "react";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, ScrapedComment, BulkReplyProgress } from "@/utils/constants";

interface ReplyState {
  isReplying: boolean;
  bulkReplyProgress: BulkReplyProgress | null;
  replyStatusMessage: string | null;
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
    bulkReplyProgress: null,
    replyStatusMessage: null,
    error: null,
  });

  useEffect(() => {
    if (!bridge) return;

    const cleanups = [
      bridge.on(MessageType.REPLY_COMMENT_PROGRESS, (payload) => {
        const { message } = payload as { message?: string };
        if (message) {
          setState((prev) => {
            if (prev.bulkReplyProgress?.status === "stopped") return prev;
            return { ...prev, replyStatusMessage: message };
          });
        }
      }),

      bridge.on(MessageType.REPLY_COMMENT_COMPLETE, (payload) => {
        const { commentId, postedReply } = payload as {
          commentId: string;
          postedReply?: ScrapedComment;
        };
        let wasStopped = false;
        setState((prev) => {
          if (prev.bulkReplyProgress?.status === "stopped") {
            wasStopped = true;
            return prev;
          }
          if (!prev.bulkReplyProgress || prev.bulkReplyProgress.total > 1) return prev;
          return {
            ...prev,
            isReplying: false,
            replyStatusMessage: null,
            bulkReplyProgress: { ...prev.bulkReplyProgress, completed: 1, status: "complete" },
          };
        });
        if (!wasStopped) {
          if (commentId && onReplyComplete) {
            onReplyComplete(commentId);
          }
          if (postedReply && onPostedReply) {
            onPostedReply(postedReply);
          }
        }
        setTimeout(() => {
          setState((prev) => {
            if (!prev.bulkReplyProgress || prev.bulkReplyProgress.total > 1) return prev;
            return { ...prev, bulkReplyProgress: null };
          });
        }, 1500);
      }),

      bridge.on(MessageType.BULK_REPLY_PROGRESS, (payload) => {
        setState((prev) => {
          if (prev.bulkReplyProgress?.status === "stopped") return prev;
          return { ...prev, bulkReplyProgress: payload as BulkReplyProgress };
        });
      }),

      bridge.on(MessageType.BULK_REPLY_COMPLETE, (payload) => {
        const progress = payload as BulkReplyProgress;
        setState((prev) => ({
          ...prev,
          isReplying: false,
          replyStatusMessage: null,
          bulkReplyProgress: progress,
        }));
        if (progress.skipped === 0 && progress.failed === 0) {
          setTimeout(() => {
            setState((prev) => ({
              ...prev,
              bulkReplyProgress: null,
            }));
          }, 1500);
        }
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [onReplyComplete, onPostedReply]);

  const startBulkReply = useCallback((comments: ScrapedComment[], messages: string[], deleteMissingComments: boolean) => {
    if (!bridge) return;

    setState((prev) => ({
      ...prev,
      isReplying: true,
      error: null,
      replyStatusMessage: null,
      bulkReplyProgress: {
        total: comments.length,
        completed: 0,
        failed: 0,
        skipped: 0,
        status: "running",
      },
    }));

    const trimmedComments = comments.map((c) => ({
      id: c.id,
      handle: c.handle,
      comment: c.comment,
      videoUrl: c.videoUrl,
      videoId: c.videoId,
      ...(c.messageToSend && { messageToSend: c.messageToSend }),
    }));

    bridge.send(MessageType.BULK_REPLY_START, { comments: trimmedComments, messages, deleteMissingComments });
  }, []);

  const updateBulkReplyQueue = useCallback((comments: ScrapedComment[]) => {
    if (!bridge) return;

    const trimmed = comments.map((c) => ({
      id: c.id,
      handle: c.handle,
      comment: c.comment,
      videoUrl: c.videoUrl,
      videoId: c.videoId,
      ...(c.messageToSend && { messageToSend: c.messageToSend }),
    }));

    bridge.send(MessageType.BULK_REPLY_UPDATE_QUEUE, { comments: trimmed });
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

  const clearBulkReplyProgress = useCallback(() => {
    setState((prev) => ({ ...prev, bulkReplyProgress: null }));
  }, []);

  return {
    ...state,
    startBulkReply,
    stopBulkReply,
    updateBulkReplyQueue,
    clearError,
    clearBulkReplyProgress,
  };
}
