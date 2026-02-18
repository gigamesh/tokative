"use client";

import { APP_NAME } from "@/utils";
import { useAuth } from "@/providers/ConvexProvider";
import { PLAN_LIMITS } from "@tokative/convex";
import { ArrowRight, Check, Gift } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const REFERRAL_CODE_RE = /^tok-[a-z2-9]{8}$/;

const PLANS = [
  {
    key: "pro" as const,
    name: "Pro",
    price: "$19",
    limits: PLAN_LIMITS.pro,
  },
  {
    key: "premium" as const,
    name: "Premium",
    price: "$49",
    limits: PLAN_LIMITS.premium,
  },
];

export default function ReferralPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const code = params.code;
  const isValid = REFERRAL_CODE_RE.test(code);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (isValid) {
      localStorage.setItem("tokative_ref", code);
    }
  }, [code, isValid]);

  useEffect(() => {
    if (!isValid) {
      router.replace("/");
    }
  }, [isValid, router]);

  async function handleSelectPlan(plan: "pro" | "premium") {
    if (!userId) {
      router.push("/sign-in");
      return;
    }

    setLoadingPlan(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: "month", trialDays: 7 }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  if (!isValid) return null;

  return (
    <div className="min-h-content bg-surface">
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-cyan-muted/20 border border-accent-cyan-muted-half">
          <Gift className="w-8 h-8 text-accent-cyan-text" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground">
            You&apos;ve been invited!
          </h1>
          <p className="text-lg text-foreground-muted">
            Try{" "}
            <span className="text-accent-cyan-text font-semibold">
              {APP_NAME}
            </span>{" "}
            free for 7 days — no charge until your trial ends.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className="p-6 rounded-xl bg-surface-secondary border border-border text-left space-y-4"
            >
              <div>
                <h3 className="text-xl font-bold text-foreground">
                  {plan.name}
                </h3>
                <p className="text-accent-cyan-text font-semibold text-lg">
                  Free for 7 days
                </p>
                <p className="text-sm text-foreground-muted">
                  Then {plan.price}/mo
                </p>
              </div>

              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Check className="w-4 h-4 text-accent-cyan-text flex-shrink-0" />
                  {plan.limits.monthlyComments.toLocaleString()} comments/mo
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Check className="w-4 h-4 text-accent-cyan-text flex-shrink-0" />
                  {plan.limits.monthlyReplies.toLocaleString()} replies/mo
                </li>
                {plan.limits.translation && (
                  <li className="flex items-center gap-2 text-sm text-foreground-muted">
                    <Check className="w-4 h-4 text-accent-cyan-text flex-shrink-0" />
                    Auto translation
                  </li>
                )}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.key)}
                disabled={loadingPlan !== null}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent-cyan-solid hover:bg-accent-cyan-solid/90 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {loadingPlan === plan.key ? (
                  "Redirecting..."
                ) : (
                  <>
                    Start Free {plan.name} Trial
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
