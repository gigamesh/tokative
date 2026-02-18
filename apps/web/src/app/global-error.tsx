"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ backgroundColor: "#0a0a0a", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ fontSize: "0.875rem", color: "#9ca3af" }}>
            An unexpected error occurred. Please try refreshing.
          </p>
          <button
            onClick={reset}
            style={{ borderRadius: "6px", backgroundColor: "rgba(255,255,255,0.1)", padding: "8px 16px", fontSize: "0.875rem", fontWeight: 500, color: "#fff", border: "none", cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>
      </body>
    </html>
  );
}
