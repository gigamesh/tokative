"use client";

import { api } from "@tokative/convex";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, Gift } from "lucide-react";
import { useCallback, useState } from "react";
import { useAuth } from "@/providers/ConvexProvider";

export function ReferralSection() {
  const { userId } = useAuth();
  const stats = useQuery(
    api.referrals.getReferralStats,
    userId ? { clerkId: userId } : "skip",
  );
  const getOrCreateCode = useMutation(api.referrals.getOrCreateReferralCode);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const referralCode = stats?.referralCode;
  const referralUrl = referralCode
    ? `${window.location.origin}/r/${referralCode}`
    : null;

  const handleGenerateCode = useCallback(async () => {
    if (!userId) return;
    setGenerating(true);
    try {
      await getOrCreateCode({ clerkId: userId });
    } finally {
      setGenerating(false);
    }
  }, [userId, getOrCreateCode]);

  const handleCopy = useCallback(async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [referralUrl]);

  if (!stats) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
        <Gift className="w-4 h-4" />
        Referral Program
      </h3>
      <p className="text-xs text-foreground-muted mb-3">
        Share your link with friends. When they subscribe to a paid plan, you get
        a free month after their subscription stays active for 7 days.
      </p>

      {referralCode ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={referralUrl ?? ""}
              className="flex-1 px-3 py-2 bg-surface-secondary border border-border rounded-lg text-sm text-foreground truncate"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-accent-cyan-solid hover:bg-accent-cyan-solid/90 text-white rounded-lg text-sm flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="flex gap-4 text-xs text-foreground-muted">
            <span>
              <span className="text-foreground font-medium">{stats.qualified}</span>{" "}
              qualified
            </span>
            <span>
              <span className="text-foreground font-medium">{stats.pending}</span>{" "}
              pending
            </span>
          </div>
        </div>
      ) : (
        <button
          onClick={handleGenerateCode}
          disabled={generating}
          className="px-4 py-2 bg-accent-cyan-solid hover:bg-accent-cyan-solid/90 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {generating ? "Generating..." : "Get your referral link"}
        </button>
      )}
    </div>
  );
}
