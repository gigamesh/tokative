export type PlanName = "free" | "pro" | "premium";

interface PlanLimits {
  monthlyComments: number;
  monthlyReplies: number;
  translation: boolean;
}

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: { monthlyComments: 500, monthlyReplies: 50, translation: false },
  pro: { monthlyComments: 2_500, monthlyReplies: 500, translation: true },
  premium: {
    monthlyComments: 17,
    monthlyReplies: 2,
    translation: true,
  },
};

export const STRIPE_PRICE_IDS = {
  pro: {
    month: "price_1Sz5wXD44KLV9Meisxwfxx6J",
    year: "price_1Sz5ymD44KLV9MeiXJ0YVACn",
  },
  premium: {
    month: "price_1Sz5z5D44KLV9MeiA6ZuEOPP",
    year: "price_1Sz5zrD44KLV9Mei8z9YV0Yw",
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

export function getMonthlyReplyLimit(plan: PlanName): number {
  return PLAN_LIMITS[plan].monthlyReplies;
}

export function hasTranslation(plan: PlanName): boolean {
  return PLAN_LIMITS[plan].translation;
}

/** Returns the start of the current UTC month as a timestamp. */
export function getCurrentMonthStart(): number {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).getTime();
}
