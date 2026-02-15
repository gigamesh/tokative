"use client";

import { Button } from "@/components/Button";
import { FormEvent, useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export function EarlyAccessForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong.");
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-cyan-500/20 mb-4">
          <svg
            className="w-7 h-7 text-accent-cyan-text"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-foreground">
          Check your email!
        </h2>
        <p className="mt-2 text-foreground-muted">
          We sent a verification link. Click it to confirm your spot.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto space-y-4">
      <input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full px-4 py-3 mb-4 rounded-lg bg-surface-secondary border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan-solid/50 focus:border-accent-cyan-solid transition-colors"
      />
      <Button
        type="submit"
        variant="primary"
        size="lg"
        pill
        fullWidth
        disabled={status === "submitting"}
        className="hover:scale-105"
      >
        {status === "submitting" ? "Joining..." : "Get Early Access"}
      </Button>
      {status === "error" && (
        <p className="text-sm text-red-400 text-center">{errorMsg}</p>
      )}
    </form>
  );
}
