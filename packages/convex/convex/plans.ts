export type PlanName = "free" | "pro" | "premium";

interface PlanLimits {
  monthlyComments: number;
  translation: boolean;
}

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: { monthlyComments: 200, translation: false },
  pro: { monthlyComments: 2_000, translation: true },
  premium: { monthlyComments: 10_000, translation: true },
};

export const STRIPE_PRICE_IDS = {
  pro: {
    month: "price_TODO_pro_monthly",
    year: "price_TODO_pro_annual",
  },
  premium: {
    month: "price_TODO_premium_monthly",
    year: "price_TODO_premium_annual",
  },
} as const;

/** Reverse lookup: Stripe price ID → plan name. */
export const PRICE_ID_TO_PLAN: Record<string, PlanName> = {
  [STRIPE_PRICE_IDS.pro.month]: "pro",
  [STRIPE_PRICE_IDS.pro.year]: "pro",
  [STRIPE_PRICE_IDS.premium.month]: "premium",
  [STRIPE_PRICE_IDS.premium.year]: "premium",
};

export function getMonthlyLimit(plan: PlanName): number {
  return PLAN_LIMITS[plan].monthlyComments;
}

export function hasTranslation(plan: PlanName): boolean {
  return PLAN_LIMITS[plan].translation;
}

/** Returns the start of the current UTC month as a timestamp. */
export function getCurrentMonthStart(): number {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
}
