"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { bridge } from "@/utils/extension-bridge";
import {
  MessageType,
  ScrapedComment,
  BulkReplyProgress,
  CommentReplyStatus,
  BulkReplyCounters,
  TERMINAL_REPLY_STATUSES,
  tallyStatuses,
  addCounters,
} from "@/utils/constants";

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

interface CarryOver {
  statuses: Record<string, CommentReplyStatus>;
  counters: BulkReplyCounters;
  total: number;
}

export function useMessaging(options: UseMessagingOptions = {}) {
  const { onReplyComplete, onPostedReply } = options;
  const carryRef = useRef<CarryOver | null>(null);
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
        const { commentId, postedReply, detectionFailed } = payload as {
          commentId: string;
          postedReply?: ScrapedComment;
          detectionFailed?: boolean;
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
            bulkReplyProgress: {
              ...prev.bulkReplyProgress,
              completed: detectionFailed ? 0 : 1,
              detectionFailed: detectionFailed ? 1 : 0,
              status: "complete",
            },
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
          const incoming = payload as BulkReplyProgress;
          const carry = carryRef.current;
          if (!carry) return { ...prev, bulkReplyProgress: incoming };
          return {
            ...prev,
            bulkReplyProgress: {
              ...incoming,
              ...addCounters(incoming, carry.counters),
              total: incoming.total + carry.total,
              commentStatuses: { ...carry.statuses, ...incoming.commentStatuses },
            },
          };
        });
      }),

      bridge.on(MessageType.BULK_REPLY_COMPLETE, (payload) => {
        const progress = payload as BulkReplyProgress;
        const carry = carryRef.current;
        carryRef.current = null;
        setState((prev) => {
          const mergedStatuses = {
            ...(carry?.statuses),
            ...prev.bulkReplyProgress?.commentStatuses,
            ...progress.commentStatuses,
          };
          if (progress.status === "stopped") {
            for (const [id, status] of Object.entries(mergedStatuses)) {
              if (status === "replying" || status === "pending") {
                delete mergedStatuses[id];
              }
            }
          }
          const carriedCounters = carry?.counters ?? { completed: 0, failed: 0, commentNotFound: 0, mentionFailed: 0, detectionFailed: 0 };
          return {
            ...prev,
            isReplying: false,
            replyStatusMessage: null,
            bulkReplyProgress: {
              ...progress,
              ...addCounters(progress, carriedCounters),
              total: progress.total + (carry?.total ?? 0),
              commentStatuses: mergedStatuses,
            },
          };
        });
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [onReplyComplete, onPostedReply]);

  const startBulkReply = useCallback((comments: ScrapedComment[], messages: string[], selectedIds: Set<string>) => {
    if (!bridge) return;

    setState((prev) => {
      const prevStatuses = prev.bulkReplyProgress?.commentStatuses ?? {};
      const terminalSet = new Set<string>(TERMINAL_REPLY_STATUSES);
      const carried: Record<string, CommentReplyStatus> = {};
      for (const [id, status] of Object.entries(prevStatuses)) {
        if (terminalSet.has(status) && selectedIds.has(id)) carried[id] = status;
      }
      const { total: carriedCount, ...carriedCounters } = tallyStatuses(carried);
      carryRef.current = carriedCount > 0
        ? { statuses: carried, counters: carriedCounters, total: carriedCount }
        : null;
      return {
        ...prev,
        isReplying: true,
        error: null,
        replyStatusMessage: null,
        bulkReplyProgress: {
          ...carriedCounters,
          total: comments.length + carriedCount,
          status: "running" as const,
          commentStatuses: carried,
        },
      };
    });

    const trimmedComments = comments.map((c) => ({
      id: c.id,
      handle: c.handle,
      comment: c.comment,
      videoUrl: c.videoUrl,
      videoId: c.videoId,
      isReply: c.isReply,
      parentCommentId: c.parentCommentId,
      ...(c.messageToSend && { messageToSend: c.messageToSend }),
    }));

    bridge.send(MessageType.BULK_REPLY_START, { comments: trimmedComments, messages });
  }, []);

  const updateBulkReplyQueue = useCallback((comments: ScrapedComment[]) => {
    if (!bridge) return;

    const trimmed = comments.map((c) => ({
      id: c.id,
      handle: c.handle,
      comment: c.comment,
      videoUrl: c.videoUrl,
      videoId: c.videoId,
      isReply: c.isReply,
      parentCommentId: c.parentCommentId,
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

  const clearBulkReplyProgress = useCallback(() => {
    carryRef.current = null;
    setState((prev) => ({ ...prev, bulkReplyProgress: null }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    startBulkReply,
    stopBulkReply,
    updateBulkReplyQueue,
    clearBulkReplyProgress,
    clearError,
  };
}
