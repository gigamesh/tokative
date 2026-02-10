"use client";

import { useState, useEffect } from "react";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, EXTENSION_SOURCE } from "@/utils/constants";

export type SetupState = "needs_extension" | "needs_connection" | "connected" | "dismissed";

export function useExtensionStatus() {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [isExtensionConnected, setIsExtensionConnected] = useState(false);
  const [setupState, setSetupState] = useState<SetupState>("needs_extension");
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let lastResponseTime = 0;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.source !== EXTENSION_SOURCE) return;

      lastResponseTime = Date.now();
      setIsExtensionInstalled(true);

      if (event.data?.type === MessageType.BRIDGE_READY) {
        setIsExtensionConnected(true);
      } else if (event.data?.type === "EXTENSION_CONTEXT_INVALID") {
        setIsExtensionConnected(false);
      }
    };

    window.addEventListener("message", handleMessage);

    window.postMessage({ type: MessageType.CHECK_BRIDGE }, "*");

    const interval = setInterval(() => {
      // If no response in the last 3 seconds, mark as disconnected
      if (lastResponseTime > 0 && Date.now() - lastResponseTime > 3000) {
        setIsExtensionConnected(false);
      }
      window.postMessage({ type: MessageType.CHECK_BRIDGE }, "*");
    }, 2000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!bridge) return;
    const cleanup = bridge.onConnectionChange((connected) => {
      setIsExtensionConnected(connected);
      if (connected) {
        setIsExtensionInstalled(true);
      }
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (isDismissed) {
      setSetupState("dismissed");
    } else if (isExtensionConnected) {
      setSetupState("connected");
    } else if (isExtensionInstalled) {
      setSetupState("needs_connection");
    } else {
      setSetupState("needs_extension");
    }
  }, [isExtensionInstalled, isExtensionConnected, isDismissed]);

  const dismissSetup = () => {
    setIsDismissed(true);
  };

  const recheckConnection = () => {
    if (bridge) {
      window.postMessage({ type: MessageType.CHECK_BRIDGE }, "*");
    }
  };

  return {
    isExtensionInstalled,
    isExtensionConnected,
    setupState,
    dismissSetup,
    recheckConnection,
  };
}
