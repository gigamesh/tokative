"use client";

import { useState } from "react";
import { useAuth } from "@/providers/ConvexProvider";
import { useQuery } from "convex/react";
import { api, STRIPE_PRICE_IDS } from "@tokative/convex";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "./Button";

type Interval = "month" | "year";

interface PlanConfig {
  name: string;
  key: "free" | "pro" | "premium";
  monthlyPrice: number;
  annualPrice: number;
  commentLimit: string;
  features: string[];
  highlighted?: boolean;
}

const PLANS: PlanConfig[] = [
  {
    name: "Free",
    key: "free",
    monthlyPrice: 0,
    annualPrice: 0,
    commentLimit: "200/month",
    features: [
      "200 comments/month",
      "Bulk reply",
      "Ignore list filtering",
      "Comment tracking",
    ],
  },
  {
    name: "Pro",
    key: "pro",
    monthlyPrice: 19,
    annualPrice: 182,
    commentLimit: "2,000/month",
    highlighted: true,
    features: [
      "2,000 comments/month",
      "Everything in Free",
      "Comment translation",
      "Priority support",
    ],
  },
  {
    name: "Premium",
    key: "premium",
    monthlyPrice: 49,
    annualPrice: 470,
    commentLimit: "10,000/month",
    features: [
      "10,000 comments/month",
      "Everything in Pro",
      "Highest collection limits",
      "Priority support",
    ],
  },
];

export function PricingContent() {
  const [interval, setInterval] = useState<Interval>("month");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { userId } = useAuth();
  const router = useRouter();

  const accessStatus = useQuery(
    api.users.getAccessStatus,
    userId ? { clerkId: userId } : "skip"
  );

  const currentPlan = accessStatus?.subscription?.plan ?? "free";

  async function handleSubscribe(planKey: "pro" | "premium") {
    if (!userId) {
      router.push("/sign-in");
      return;
    }

    setLoadingPlan(planKey);
    try {
      const priceId = STRIPE_PRICE_IDS[planKey][interval];
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handleManageSubscription() {
    setLoadingPlan("manage");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="min-h-content bg-surface">
      <main className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-foreground-muted text-lg">
            Start free. Upgrade when you need more.
          </p>

          <div className="mt-8 inline-flex items-center bg-surface-secondary rounded-full p-1">
            <button
              onClick={() => setInterval("month")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                interval === "month"
                  ? "bg-surface-elevated text-foreground"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("year")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                interval === "year"
                  ? "bg-surface-elevated text-foreground"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs text-green-400">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.key;
            const price =
              interval === "month"
                ? plan.monthlyPrice
                : Math.round((plan.annualPrice / 12) * 100) / 100;
            const isLoading = loadingPlan === plan.key;

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl p-6 flex flex-col ${
                  plan.highlighted
                    ? "border-2 border-accent-cyan-solid bg-surface-elevated"
                    : "border border-border bg-surface-elevated"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-cyan-solid text-white text-xs font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    {plan.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      ${interval === "month" ? plan.monthlyPrice : price.toFixed(0)}
                    </span>
                    {plan.monthlyPrice > 0 && (
                      <span className="text-foreground-muted text-sm">
                        /mo
                      </span>
                    )}
                  </div>
                  {interval === "year" && plan.annualPrice > 0 && (
                    <p className="text-xs text-foreground-muted mt-1">
                      ${plan.annualPrice}/year billed annually
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-foreground-secondary"
                    >
                      <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <div className="space-y-2">
                    <div className="text-center text-sm text-foreground-muted font-medium py-2 border border-border rounded-lg">
                      Current Plan
                    </div>
                    {plan.key !== "free" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onClick={handleManageSubscription}
                        disabled={loadingPlan === "manage"}
                      >
                        {loadingPlan === "manage" ? "Loading..." : "Manage Subscription"}
                      </Button>
                    )}
                  </div>
                ) : plan.key === "free" ? (
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() =>
                      router.push(userId ? "/dashboard" : "/sign-in")
                    }
                  >
                    Get Started
                  </Button>
                ) : (
                  <Button
                    variant={plan.highlighted ? "primary" : "secondary"}
                    fullWidth
                    onClick={() => handleSubscribe(plan.key as "pro" | "premium")}
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading..." : "Subscribe"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-foreground-muted mt-10">
          Need a higher limit?{" "}
          <a
            href="mailto:support@tokative.com"
            className="text-accent-cyan-text hover:underline"
          >
            Contact us for a custom plan.
          </a>
        </p>
      </main>
    </div>
  );
}
