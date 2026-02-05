"use client";

import { useState, useEffect } from "react";
import { useExtensionStatus } from "@/hooks/useExtensionStatus";
import { useQuery, useMutation } from "convex/react";
import { api } from "@tokative/convex";
import { useAuth } from "@/providers/ConvexProvider";
import { AlertTriangle, Check, Zap } from "lucide-react";

export function SetupBanner() {
  const { setupState, dismissSetup, recheckConnection } = useExtensionStatus();
  const [showSuccess, setShowSuccess] = useState(false);
  const { isLoaded: isAuthLoaded } = useAuth();
  const settings = useQuery(api.settings.getForCurrentUser);
  const markSetupComplete = useMutation(api.settings.markSetupComplete);

  const isLoading = settings === undefined;
  const hasCompletedSetup = settings?.hasCompletedSetup ?? false;

  useEffect(() => {
    if (!isAuthLoaded || isLoading) return;
    if (setupState === "connected" && !hasCompletedSetup) {
      setShowSuccess(true);
      markSetupComplete();
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [setupState, hasCompletedSetup, isLoading, isAuthLoaded, markSetupComplete]);

  if (isLoading || setupState === "dismissed") {
    return null;
  }

  if (setupState === "connected" && showSuccess && !hasCompletedSetup) {
    return (
      <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <span className="text-green-400">
            You're all set! Go to TikTok to start scraping.
          </span>
        </div>
        <button
          onClick={dismissSetup}
          className="text-green-400 hover:text-green-300 transition-colors"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (setupState === "connected") {
    return null;
  }

  if (setupState === "needs_extension") {
    return (
      <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-yellow-400 font-medium mb-1">Setup Required</h3>
            <p className="text-yellow-400/80 text-sm mb-3">
              Install the Tokative Chrome extension to start scraping.
            </p>
            <a
              href="#install-extension"
              onClick={(e) => {
                e.preventDefault();
                alert(
                  "Extension installation: Load the extension from apps/extension/dist in Chrome's extension manager (chrome://extensions) with Developer mode enabled."
                );
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-md transition-colors text-sm"
            >
              Install Extension
              <Zap className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (setupState === "needs_connection") {
    return (
      <div className="mb-6 p-4 bg-accent-cyan-muted/20 border border-accent-cyan-muted/50 rounded-lg">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-accent-cyan-text flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-accent-cyan-text font-medium mb-1">Almost there!</h3>
            <p className="text-accent-cyan-text/80 text-sm mb-3">
              Open the Tokative extension and click "Connect to Dashboard"
            </p>
            <button
              onClick={recheckConnection}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-cyan-solid hover:bg-accent-cyan-solid-hover text-white font-medium rounded-md transition-colors text-sm"
            >
              I've connected
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
