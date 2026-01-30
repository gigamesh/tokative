"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { MessageType } from "@/utils/constants";

export function AuthBridge() {
  const { userId, isLoaded, getToken } = useClerkAuth();
  const previousUserId = useRef<string | null>(null);

  const sendToken = useCallback(async () => {
    if (!userId) return;
    const token = await getToken({ template: "convex" });
    if (token) {
      window.postMessage(
        {
          type: MessageType.AUTH_TOKEN_RESPONSE,
          source: "dashboard",
          payload: { token },
        },
        "*"
      );
    }
  }, [userId, getToken]);

  useEffect(() => {
    if (isLoaded && userId && previousUserId.current !== userId) {
      previousUserId.current = userId;
      sendToken();
    }
  }, [userId, isLoaded, sendToken]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.type !== MessageType.GET_AUTH_TOKEN) return;
      await sendToken();
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendToken]);

  return null;
}
