"use client";

import { useState, useEffect } from "react";
import { bridge } from "@/utils/extension-bridge";

export function ConnectionStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!bridge) {
      setConnected(false);
      return;
    }

    const cleanup = bridge.onConnectionChange(setConnected);
    return cleanup;
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
        connected
          ? "bg-green-500/20 text-green-400"
          : "bg-red-500/20 text-red-400"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          connected ? "bg-green-400" : "bg-red-400"
        }`}
      />
      {connected ? "Extension Connected" : "Extension Not Connected"}
    </div>
  );
}
