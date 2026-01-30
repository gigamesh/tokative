"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/providers/ConvexProvider";
import { MessageType } from "@/utils/constants";

export function AuthBridge() {
  const { userId, isLoaded } = useAuth();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (isLoaded && userId && previousUserId.current !== userId) {
      previousUserId.current = userId;
      window.postMessage(
        {
          type: MessageType.AUTH_TOKEN_RESPONSE,
          source: "dashboard",
          payload: { token: userId },
        },
        "*"
      );
    }
  }, [userId, isLoaded]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.type !== MessageType.GET_AUTH_TOKEN) return;

      window.postMessage(
        {
          type: MessageType.AUTH_TOKEN_RESPONSE,
          source: "dashboard",
          payload: { token: userId },
        },
        "*"
      );
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [userId]);

  return null;
}
