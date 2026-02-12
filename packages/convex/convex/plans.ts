import { isPremiumWhitelisted } from "./constants";

export const BILLING_ENABLED = false;

export type PlanName = "free" | "pro" | "premium";

interface PlanLimits {
  monthlyComments: number;
  monthlyReplies: number;
  translation: boolean;
}

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: { monthlyComments: 500, monthlyReplies: 100, translation: false },
  pro: { monthlyComments: 3_000, monthlyReplies: 1_000, translation: true },
  premium: {
    monthlyComments: 25_000,
    monthlyReplies: 5_000,
    translation: true,
  },
};

type PriceIds = Record<"pro" | "premium", Record<"month" | "year", string>>;

const LIVE_PRICE_IDS: PriceIds = {
  pro: {
    month: "price_1SzkTdD44KLV9Mei8w3ursNW",
    year: "price_1SzkTdD44KLV9MeiSc1DQoZg",
  },
  premium: {
    month: "price_1SzkVKD44KLV9MeiIwJGFnXh",
    year: "price_1SzkVLD44KLV9Mei6SEfSAta",
  },
};

const TEST_PRICE_IDS: PriceIds = {
  pro: {
    month: "price_1SzkCrRXoR21ZKCjjk3t4V90",
    year: "price_1SzkCrRXoR21ZKCjOqZDnP4N",
  },
  premium: {
    month: "price_1SzkCsRXoR21ZKCjP8jkimMf",
    year: "price_1SzkCsRXoR21ZKCjcEW1arrL",
  },
};

/** Resolves the correct Stripe price ID set based on the secret key. */
export function getStripePriceIds(stripeSecretKey: string): PriceIds {
  return stripeSecretKey.startsWith("sk_test_")
    ? TEST_PRICE_IDS
    : LIVE_PRICE_IDS;
}

/** Reverse lookup: Stripe price ID → plan name (covers both live and test). */
export function priceIdToPlanName(priceId: string): PlanName {
  for (const ids of [LIVE_PRICE_IDS, TEST_PRICE_IDS]) {
    for (const [plan, intervals] of Object.entries(ids)) {
      if (intervals.month === priceId || intervals.year === priceId) {
        return plan as PlanName;
      }
    }
  }
  return "free";
}

/** Resolves a user's effective plan, accounting for email whitelisting. */
export function getEffectivePlan(user: {
  email?: string;
  subscriptionPlan?: PlanName;
}): PlanName {
  return isPremiumWhitelisted(user.email ?? "")
    ? "premium"
    : (user.subscriptionPlan ?? "free");
}

export function getMonthlyLimit(plan: PlanName): number {
  if (!BILLING_ENABLED) return Number.MAX_SAFE_INTEGER;
  return PLAN_LIMITS[plan].monthlyComments;
}

export function getMonthlyReplyLimit(plan: PlanName): number {
  if (!BILLING_ENABLED) return Number.MAX_SAFE_INTEGER;
  return PLAN_LIMITS[plan].monthlyReplies;
}

export function hasTranslation(plan: PlanName): boolean {
  if (!BILLING_ENABLED) return true;
  return PLAN_LIMITS[plan].translation;
}

/** Returns the start of the current UTC month as a timestamp. */
export function getCurrentMonthStart(): number {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).getTime();
}
