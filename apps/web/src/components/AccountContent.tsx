"use client";

import { useAuth } from "@/providers/ConvexProvider";
import { useQuery } from "convex/react";
import { api } from "@tokative/convex";
import { Button } from "./Button";
import Link from "next/link";
import { useCallback, useState } from "react";

export function AccountContent() {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);

  const accessStatus = useQuery(
    api.users.getAccessStatus,
    userId ? { clerkId: userId } : "skip"
  );

  const subscription = accessStatus?.subscription;

  const handleManageSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  if (!subscription) {
    return (
      <div className="min-h-content bg-surface">
        <main className="max-w-2xl mx-auto px-6 py-20">
          <div className="bg-surface-elevated rounded-lg p-6 animate-pulse h-48" />
        </main>
      </div>
    );
  }

  const usagePct = Math.min(
    100,
    Math.round((subscription.monthlyUsed / subscription.monthlyLimit) * 100)
  );

  const renewalDate = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className="min-h-content bg-surface">
      <main className="max-w-2xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-bold text-foreground mb-8">Account</h1>

        <div className="bg-surface-elevated rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-foreground mb-4">
              Subscription
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-foreground font-medium capitalize">
                  {subscription.plan} Plan
                </span>
                {subscription.status === "active" && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
                {subscription.status === "past_due" && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                    Payment Issue
                  </span>
                )}
                {subscription.status === "canceled" && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                    Canceled
                  </span>
                )}
              </div>

              {subscription.interval && subscription.plan !== "free" && (
                <p className="text-sm text-foreground-muted capitalize">
                  Billed {subscription.interval === "year" ? "annually" : "monthly"}
                </p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium text-foreground mb-4">
              Monthly Usage
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-foreground-muted">Comments collected</span>
                <span className="text-foreground-secondary">
                  {subscription.monthlyUsed.toLocaleString()} /{" "}
                  {subscription.monthlyLimit.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePct > 90 ? "bg-red-500" : "bg-accent-cyan-solid"
                  }`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <p className="text-xs text-foreground-muted">
                {usagePct}% of monthly limit used
              </p>
            </div>
          </div>

          {renewalDate && subscription.plan !== "free" && (
            <p className="text-sm text-foreground-muted">
              {subscription.status === "canceled" ? "Expires" : "Renews"} on{" "}
              {renewalDate}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            {subscription.plan === "free" ? (
              <Link href="/pricing">
                <Button variant="primary">Upgrade Plan</Button>
              </Link>
            ) : (
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={loading}
              >
                {loading ? "Loading..." : "Manage Subscription"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
