"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-white">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-gray-400">
        An unexpected error occurred. Please try refreshing.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}
