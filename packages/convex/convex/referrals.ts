import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";

export const QUALIFICATION_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const REFERRAL_DISCOUNT_CENTS = 1900; // $19 off next invoice

const UNAMBIGUOUS_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += UNAMBIGUOUS_CHARS[Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length)];
  }
  return `TOK-${code}`;
}

/** Normalizes a Gmail address by stripping dots and +suffixes. */
function normalizeEmail(email: string): string {
  const lower = email.toLowerCase().trim();
  const [local, domain] = lower.split("@");
  if (!domain) return lower;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    const stripped = local.replace(/\./g, "").replace(/\+.*$/, "");
    return `${stripped}@gmail.com`;
  }
  return lower;
}

export const getOrCreateReferralCode = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) throw new Error("User not found");

    if (user.referralCode) return user.referralCode;

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateCode();
      const existing = await ctx.db
        .query("users")
        .withIndex("by_referral_code", (q) => q.eq("referralCode", code))
        .unique();
      if (!existing) {
        await ctx.db.patch(user._id, { referralCode: code });
        return code;
      }
    }
    throw new Error("Failed to generate unique referral code");
  },
});

export const getReferralStats = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) return null;

    const allReferrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", user._id))
      .collect();

    const pending = allReferrals.filter((r) => r.status === "pending").length;
    const qualified = allReferrals.filter((r) => r.status === "qualified").length;

    return {
      referralCode: user.referralCode ?? null,
      pending,
      qualified,
    };
  },
});

export const applyReferralCode = mutation({
  args: {
    referredClerkId: v.string(),
    referralCode: v.string(),
  },
  handler: async (ctx, args) => {
    const referredUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.referredClerkId))
      .unique();
    if (!referredUser) throw new Error("Referred user not found");

    if (referredUser.referredByUserId) return { applied: false, reason: "already_referred" };

    const referrer = await ctx.db
      .query("users")
      .withIndex("by_referral_code", (q) => q.eq("referralCode", args.referralCode))
      .unique();
    if (!referrer) return { applied: false, reason: "invalid_code" };

    if (referrer._id === referredUser._id) {
      return { applied: false, reason: "self_referral" };
    }

    if (referrer.email && referredUser.email) {
      if (normalizeEmail(referrer.email) === normalizeEmail(referredUser.email)) {
        return { applied: false, reason: "same_email" };
      }
    }

    await ctx.db.patch(referredUser._id, { referredByUserId: referrer._id });
    await ctx.db.insert("referrals", {
      referrerId: referrer._id,
      referredId: referredUser._id,
      status: "pending",
      createdAt: Date.now(),
    });

    return { applied: true };
  },
});

/** Scheduled function: runs 7 days after subscription activation to qualify a referral. */
export const qualifyReferral = internalMutation({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    const referral = await ctx.db.get(args.referralId);
    if (!referral || referral.status !== "pending") return;

    const referredUser = await ctx.db.get(referral.referredId);
    if (
      !referredUser ||
      referredUser.subscriptionStatus !== "active" ||
      referredUser.subscriptionPlan === "free"
    ) {
      return;
    }

    await ctx.db.patch(args.referralId, {
      status: "qualified",
      qualifiedAt: Date.now(),
    });

    const referrer = await ctx.db.get(referral.referrerId);
    if (referrer?.stripeSubscriptionId && referrer.subscriptionStatus === "active") {
      await ctx.scheduler.runAfter(0, internal.stripe.applyReferralCredit, {
        referralId: args.referralId,
        referrerUserId: referral.referrerId,
      });
    }
  },
});
