"use client";

import { useState, useEffect } from "react";
import { useExtensionStatus } from "@/hooks/useExtensionStatus";
import { useQuery, useMutation } from "convex/react";
import { api } from "@tiktok-buddy/convex";

export function SetupBanner() {
  const { setupState, dismissSetup, recheckConnection } = useExtensionStatus();
  const [showSuccess, setShowSuccess] = useState(false);
  const settings = useQuery(api.settings.getForCurrentUser);
  const markSetupComplete = useMutation(api.settings.markSetupComplete);

  const isLoading = settings === undefined;
  const hasCompletedSetup = settings?.hasCompletedSetup ?? false;

  useEffect(() => {
    if (!isLoading && setupState === "connected" && !hasCompletedSetup) {
      setShowSuccess(true);
      markSetupComplete();
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [setupState, hasCompletedSetup, isLoading, markSetupComplete]);

  if (isLoading || setupState === "dismissed") {
    return null;
  }

  if (setupState === "connected" && showSuccess && !hasCompletedSetup) {
    return (
      <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-green-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
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
          <svg
            className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-yellow-400 font-medium mb-1">Setup Required</h3>
            <p className="text-yellow-400/80 text-sm mb-3">
              Install the TikTok Buddy Chrome extension to start scraping.
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
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (setupState === "needs_connection") {
    return (
      <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-blue-400 font-medium mb-1">Almost there!</h3>
            <p className="text-blue-400/80 text-sm mb-3">
              Open the TikTok Buddy extension and click "Connect to Dashboard"
            </p>
            <button
              onClick={recheckConnection}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors text-sm"
            >
              I've connected
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
