"use client";

import { useEffect } from "react";
import { useAuth } from "@/providers/ConvexProvider";
import { MessageType } from "@/utils/constants";

export function AuthBridge() {
  const { userId } = useAuth();

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
