"use client";

import { useAuth } from "@/providers/ConvexProvider";
import { api, REFERRAL_CREDIT } from "@tokative/convex";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, DollarSign, Gift, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function ReferralSection() {
  const { userId } = useAuth();
  const stats = useQuery(
    api.referrals.getReferralStats,
    userId ? { clerkId: userId } : "skip",
  );
  const getOrCreateCode = useMutation(api.referrals.getOrCreateReferralCode);
  const [copied, setCopied] = useState(false);
  const hasTriggered = useRef(false);

  const referralCode = stats?.referralCode;
  const referralUrl = referralCode
    ? `${window.location.origin}/r/${referralCode}`
    : null;

  useEffect(() => {
    if (!userId || referralCode || !stats || hasTriggered.current) return;
    hasTriggered.current = true;
    getOrCreateCode({ clerkId: userId });
  }, [userId, referralCode, stats, getOrCreateCode]);

  const handleCopy = useCallback(async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [referralUrl]);

  if (!stats) return null;

  return (
    <div className="space-y-5">
      <div className="flex gap-4 items-center">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent-cyan-muted/20 border border-accent-cyan-muted-half flex items-center justify-center">
          <Gift className="w-5 h-5 text-accent-cyan-text" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          Referral Program
        </h3>
      </div>
      <h4 className="text-sm font-medium text-foreground">
        Earn ${REFERRAL_CREDIT / 100} for every friend who subscribes!
      </h4>
      <p className="text-sm text-foreground-muted text-balance">
        Each friend gets 7 days of a paid plan for free. You get a $
        {REFERRAL_CREDIT / 100} credit per subscriber.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-secondary border border-border">
          <Users className="w-4 h-4 text-accent-cyan-text flex-shrink-0" />
          <div>
            <p className="text-lg font-bold text-foreground leading-tight">
              {stats.pending + stats.qualified}
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">Referrals</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-secondary border border-border">
          <DollarSign className="w-4 h-4 text-green-400 flex-shrink-0" />
          <div>
            <p className="text-lg font-bold text-foreground leading-tight">
              ${stats.qualified * (REFERRAL_CREDIT / 100)}
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">
              Credits earned
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
          Your referral link
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={referralUrl ?? "Generating..."}
            className="flex-1 px-3 py-2.5 bg-surface-secondary border border-border rounded-lg text-sm text-foreground truncate"
          />
          <button
            onClick={handleCopy}
            disabled={!referralUrl}
            className="px-4 py-2.5 bg-accent-cyan-solid hover:bg-accent-cyan-solid/90 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Link
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
