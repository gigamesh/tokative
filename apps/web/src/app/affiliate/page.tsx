"use client";

import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/providers/ConvexProvider";
import { BASE_URL } from "@/utils";
import { api } from "@tokative/convex";
import { useQuery } from "convex/react";
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AffiliateDashboardPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const status = useQuery(
    api.affiliates.getAffiliateStatus,
    isLoaded && userId ? { clerkId: userId } : "skip"
  );
  const commissions = useQuery(
    api.affiliates.getCommissions,
    isLoaded && userId ? { clerkId: userId } : "skip"
  );
  const subscribers = useQuery(
    api.affiliates.getAffiliateSubscribers,
    isLoaded && userId ? { clerkId: userId } : "skip"
  );

  if (!isLoaded || status === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  if (status === null) {
    return (
      <div className="min-h-content bg-surface flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-foreground-muted mx-auto" />
          <h1 className="text-xl font-bold text-foreground">
            Affiliate Access Required
          </h1>
          <p className="text-foreground-muted">
            You are not registered as an affiliate partner.
          </p>
        </div>
      </div>
    );
  }

  const affiliateLink = `${BASE_URL}/a/${status.affiliateCode}`;

  async function copyLink() {
    await navigator.clipboard.writeText(affiliateLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSetupPayouts() {
    setLoading("onboarding");
    try {
      const res = await fetch("/api/affiliate/onboarding", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleViewStripeDashboard() {
    setLoading("dashboard");
    try {
      const res = await fetch("/api/affiliate/dashboard-link", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } finally {
      setLoading(null);
    }
  }

  const statusLabel: Record<string, string> = {
    pending: "Payouts not set up",
    onboarding: "Stripe onboarding in progress",
    active: "Payouts enabled",
    restricted: "Account restricted",
  };

  const statusColor: Record<string, string> = {
    pending: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    onboarding: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    active: "text-green-400 bg-green-500/10 border-green-500/30",
    restricted: "text-red-400 bg-red-500/10 border-red-500/30",
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Affiliate Dashboard
        </h1>
        <div
          className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${statusColor[status.connectStatus]}`}
        >
          {statusLabel[status.connectStatus]}
        </div>
      </div>

      {status.connectStatus === "pending" && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-foreground-muted mb-3">
            Set up your Stripe Express account to receive commission payouts.
          </p>
          <Button
            variant="secondary"
            onClick={handleSetupPayouts}
            disabled={loading !== null}
          >
            {loading === "onboarding" ? "Redirecting..." : "Set Up Payouts"}
          </Button>
        </div>
      )}

      {status.connectStatus === "onboarding" && (
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <p className="text-foreground-muted mb-3">
            Your Stripe onboarding is incomplete. Please finish setting up your
            account.
          </p>
          <Button
            variant="secondary"
            onClick={handleSetupPayouts}
            disabled={loading !== null}
          >
            {loading === "onboarding"
              ? "Redirecting..."
              : "Continue Stripe Setup"}
          </Button>
        </div>
      )}

      {/* Affiliate Link */}
      <div className="p-4 rounded-lg bg-surface-elevated border border-border">
        <p className="text-sm text-foreground-muted mb-2">Your affiliate link</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-surface rounded-lg text-sm text-foreground select-all border border-border">
            {affiliateLink}
          </code>
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Earned"
          value={formatCents(status.totalEarnedCents)}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          label="Held (60-day)"
          value={formatCents(status.heldCents)}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Available"
          value={formatCents(status.availableCents)}
          icon={<Check className="w-5 h-5" />}
        />
        <StatCard
          label="Subscribers"
          value={String(status.subscriberCount)}
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {status.connectStatus === "active" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleViewStripeDashboard}
          disabled={loading !== null}
        >
          <ExternalLink className="w-4 h-4" />
          {loading === "dashboard" ? "Opening..." : "View Stripe Dashboard"}
        </Button>
      )}

      {/* Subscribers Table */}
      {subscribers && subscribers.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Subscribers
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-elevated text-foreground-muted">
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Since</th>
                  <th className="text-right px-4 py-3 font-medium">
                    Commission
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subscribers.map((sub) => (
                  <tr key={sub.subscriberId} className="text-foreground">
                    <td className="px-4 py-3 capitalize">{sub.plan}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          sub.status === "active"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {formatDate(sub.subscribedSince)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCents(sub.totalCommissionCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commission History */}
      {commissions && commissions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Commission History
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-elevated text-foreground-muted">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-right px-4 py-3 font-medium">Invoice</th>
                  <th className="text-right px-4 py-3 font-medium">
                    Commission
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">
                    Release Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissions.map((c) => (
                  <tr key={c._id} className="text-foreground">
                    <td className="px-4 py-3 text-foreground-muted">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCents(c.invoiceAmountCents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCents(c.commissionCents)}
                    </td>
                    <td className="px-4 py-3">
                      <CommissionStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-foreground-muted">
                      {c.transferredAt
                        ? formatDate(c.transferredAt)
                        : c.status === "held"
                          ? formatDate(c.availableAt)
                          : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-lg bg-surface-elevated border border-border">
      <div className="flex items-center gap-2 text-foreground-muted mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function CommissionStatusBadge({
  status,
}: {
  status: "held" | "available" | "transferred" | "reversed";
}) {
  const styles: Record<string, string> = {
    held: "bg-amber-500/10 text-amber-400",
    available: "bg-blue-500/10 text-blue-400",
    transferred: "bg-green-500/10 text-green-400",
    reversed: "bg-red-500/10 text-red-400",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}
