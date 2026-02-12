"use client";

import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "./Button";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-500/20 text-green-400" },
  past_due: {
    label: "Payment Issue",
    className: "bg-yellow-500/20 text-yellow-400",
  },
  canceled: { label: "Canceled", className: "bg-red-500/20 text-red-400" },
};

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-foreground-muted">{label}</span>
        <span className="text-foreground-secondary">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="w-full h-2 bg-surface-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct > 90 ? "bg-red-500" : "bg-accent-cyan-solid"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-foreground-muted">
        {pct}% of monthly limit used
      </p>
    </div>
  );
}

export function AccountContent() {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);

  const accessStatus = useQuery(
    api.users.getAccessStatus,
    userId ? { clerkId: userId } : "skip",
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

  const badge =
    subscription.plan === "free"
      ? undefined
      : subscription.cancelAtPeriodEnd && subscription.status === "active"
        ? { label: "Canceling", className: "bg-yellow-500/20 text-yellow-400" }
        : subscription.status
          ? STATUS_BADGES[subscription.status]
          : undefined;
  const canUpgrade = subscription.plan !== "premium";
  const showManage = subscription.plan !== "free";

  const renewalDate = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  console.log(JSON.stringify(subscription, null, 2));

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
                {badge && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                )}
              </div>

              {subscription.interval && subscription.plan !== "free" && (
                <p className="text-sm text-foreground-muted capitalize">
                  Billed{" "}
                  {subscription.interval === "year" ? "annually" : "monthly"}
                </p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-medium text-foreground mb-4">
              Monthly Usage
            </h2>
            <UsageBar
              label="Comments collected"
              used={subscription.monthlyUsed}
              limit={subscription.monthlyLimit}
            />
            <div className="mt-4">
              <UsageBar
                label="Replies sent"
                used={subscription.repliesUsed ?? 0}
                limit={subscription.replyLimit ?? 0}
              />
            </div>
          </div>

          {subscription.plan !== "free" &&
            (subscription.cancelAtPeriodEnd ? (
              <p className="text-sm text-foreground-muted">
                {renewalDate
                  ? `Ends on ${renewalDate}`
                  : "Subscription canceled"}
              </p>
            ) : (
              renewalDate && (
                <p className="text-sm text-foreground-muted">
                  Renews on {renewalDate}
                </p>
              )
            ))}

          <div className="flex gap-3 pt-2">
            {canUpgrade && (
              <Link href="/pricing">
                <Button variant="primary">Upgrade Plan</Button>
              </Link>
            )}
            {showManage && (
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
