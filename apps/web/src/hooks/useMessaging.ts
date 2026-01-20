"use client";

import { useState, useEffect, useCallback } from "react";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, ScrapedUser, BulkSendProgress } from "@/utils/constants";

interface SendProgress {
  userId: string;
  status: "opening" | "typing" | "sending" | "complete" | "error";
  message?: string;
}

interface MessagingState {
  isSending: boolean;
  currentProgress: SendProgress | null;
  bulkProgress: BulkSendProgress | null;
  error: string | null;
}

export function useMessaging() {
  const [state, setState] = useState<MessagingState>({
    isSending: false,
    currentProgress: null,
    bulkProgress: null,
    error: null,
  });

  useEffect(() => {
    if (!bridge) return;

    const cleanups = [
      bridge.on(MessageType.SEND_MESSAGE_PROGRESS, (payload) => {
        setState((prev) => ({
          ...prev,
          currentProgress: payload as SendProgress,
        }));
      }),

      bridge.on(MessageType.SEND_MESSAGE_COMPLETE, (payload) => {
        setState((prev) => ({
          ...prev,
          isSending: false,
          currentProgress: null,
        }));
      }),

      bridge.on(MessageType.SEND_MESSAGE_ERROR, (payload) => {
        const { error } = payload as { error: string };
        setState((prev) => ({
          ...prev,
          isSending: false,
          currentProgress: null,
          error,
        }));
      }),

      bridge.on(MessageType.BULK_SEND_PROGRESS, (payload) => {
        setState((prev) => ({
          ...prev,
          bulkProgress: payload as BulkSendProgress,
        }));
      }),

      bridge.on(MessageType.BULK_SEND_COMPLETE, (payload) => {
        setState((prev) => ({
          ...prev,
          isSending: false,
          bulkProgress: payload as BulkSendProgress,
        }));
      }),

      bridge.on(MessageType.BULK_SEND_ERROR, (payload) => {
        const { error } = payload as { error: string };
        setState((prev) => ({
          ...prev,
          isSending: false,
          bulkProgress: null,
          error,
        }));
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  const sendMessage = useCallback((user: ScrapedUser, message: string) => {
    if (!bridge) return;

    setState((prev) => ({
      ...prev,
      isSending: true,
      error: null,
      currentProgress: { userId: user.id, status: "opening" },
    }));

    bridge.send(MessageType.SEND_MESSAGE, { user, message });
  }, []);

  const startBulkSend = useCallback((userIds: string[], templateId: string) => {
    if (!bridge) return;

    setState((prev) => ({
      ...prev,
      isSending: true,
      error: null,
      bulkProgress: {
        total: userIds.length,
        completed: 0,
        failed: 0,
        status: "running",
      },
    }));

    bridge.send(MessageType.BULK_SEND_START, { userIds, templateId });
  }, []);

  const stopBulkSend = useCallback(() => {
    if (!bridge) return;

    bridge.send(MessageType.BULK_SEND_STOP);
    setState((prev) => ({
      ...prev,
      isSending: false,
      bulkProgress: prev.bulkProgress
        ? { ...prev.bulkProgress, status: "stopped" }
        : null,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    sendMessage,
    startBulkSend,
    stopBulkSend,
    clearError,
  };
}
