import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

export const getAffiliateStatus = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) return null;

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!affiliate) return null;

    const commissions = await ctx.db
      .query("affiliateCommissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
      .collect();

    const held = commissions
      .filter((c) => c.status === "held")
      .reduce((s, c) => s + c.commissionCents, 0);
    const available = commissions
      .filter((c) => c.status === "available")
      .reduce((s, c) => s + c.commissionCents, 0);
    const transferred = commissions
      .filter((c) => c.status === "transferred")
      .reduce((s, c) => s + c.commissionCents, 0);

    const subscriberIds = new Set(commissions.map((c) => c.subscriberUserId));

    return {
      affiliateCode: affiliate.affiliateCode,
      connectStatus: affiliate.connectStatus,
      isWhitelisted: affiliate.isWhitelisted,
      agreementAcceptedAt: affiliate.agreementAcceptedAt,
      heldCents: held,
      availableCents: available,
      transferredCents: transferred,
      totalEarnedCents: held + available + transferred,
      subscriberCount: subscriberIds.size,
    };
  },
});

export const getCommissions = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) return [];

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!affiliate) return [];

    const commissions = await ctx.db
      .query("affiliateCommissions")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
      .order("desc")
      .collect();

    return commissions.map((c) => ({
      _id: c._id,
      commissionCents: c.commissionCents,
      invoiceAmountCents: c.invoiceAmountCents,
      status: c.status,
      availableAt: c.availableAt,
      createdAt: c.createdAt,
      transferredAt: c.transferredAt,
    }));
  },
});

export const getAffiliateSubscribers = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) return [];

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!affiliate) return [];

    const subscribers = await ctx.db
      .query("users")
      .withIndex("by_affiliate", (q) =>
        q.eq("affiliatedByAffiliateId", affiliate._id)
      )
      .collect();

    const results = [];
    for (const sub of subscribers) {
      const commissions = await ctx.db
        .query("affiliateCommissions")
        .withIndex("by_affiliate", (q) => q.eq("affiliateId", affiliate._id))
        .collect();

      const subCommissions = commissions.filter(
        (c) => c.subscriberUserId === sub._id && c.status !== "reversed"
      );
      const totalCommission = subCommissions.reduce(
        (s, c) => s + c.commissionCents,
        0
      );

      results.push({
        subscriberId: sub._id,
        plan: sub.subscriptionPlan ?? "free",
        status: sub.subscriptionStatus ?? "canceled",
        subscribedSince: sub.createdAt,
        totalCommissionCents: totalCommission,
      });
    }

    return results;
  },
});

export const applyAffiliateCode = mutation({
  args: {
    referredClerkId: v.string(),
    affiliateCode: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.referredClerkId))
      .unique();
    if (!user) throw new Error("User not found");

    if (user.affiliatedByAffiliateId)
      return { applied: false, reason: "already_affiliated" };

    if (user.referredByUserId)
      return { applied: false, reason: "has_referral" };

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_code", (q) => q.eq("affiliateCode", args.affiliateCode))
      .unique();
    if (!affiliate || !affiliate.isWhitelisted)
      return { applied: false, reason: "invalid_code" };

    if (affiliate.userId === user._id)
      return { applied: false, reason: "self_affiliate" };

    const affiliateUser = await ctx.db.get(affiliate.userId);
    if (affiliateUser?.email && user.email) {
      if (normalizeEmail(affiliateUser.email) === normalizeEmail(user.email)) {
        return { applied: false, reason: "same_email" };
      }
    }

    await ctx.db.patch(user._id, {
      affiliatedByAffiliateId: affiliate._id,
    });

    return { applied: true };
  },
});

export const acceptAgreement = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) throw new Error("User not found");

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!affiliate) throw new Error("Not an affiliate");

    await ctx.db.patch(affiliate._id, {
      agreementAcceptedAt: Date.now(),
    });
  },
});
