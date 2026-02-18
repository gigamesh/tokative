import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { AFFILIATE_HOLD_DAYS } from "./affiliateConstants";

const HOLD_MS = AFFILIATE_HOLD_DAYS * 24 * 60 * 60 * 1000;

export const getAffiliateByCode = internalQuery({
  args: { affiliateCode: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("affiliates")
      .withIndex("by_code", (q) => q.eq("affiliateCode", args.affiliateCode))
      .unique();
  },
});

export const getAffiliateByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const getAffiliateByConnectAccount = internalQuery({
  args: { stripeConnectAccountId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("affiliates")
      .withIndex("by_connect_account", (q) =>
        q.eq("stripeConnectAccountId", args.stripeConnectAccountId)
      )
      .unique();
  },
});

export const getCommission = internalQuery({
  args: { commissionId: v.id("affiliateCommissions") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.commissionId);
  },
});

export const getAffiliate = internalQuery({
  args: { affiliateId: v.id("affiliates") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.affiliateId);
  },
});

const UNAMBIGUOUS_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

function generateAffiliateCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code +=
      UNAMBIGUOUS_CHARS[Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length)];
  }
  return `aff-${code}`;
}

export const createAffiliate = internalMutation({
  args: {
    userId: v.id("users"),
    commissionRate: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("affiliates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) throw new Error("User is already an affiliate");

    let affiliateCode: string;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateAffiliateCode();
      const taken = await ctx.db
        .query("affiliates")
        .withIndex("by_code", (q) => q.eq("affiliateCode", candidate))
        .unique();
      if (!taken) {
        affiliateCode = candidate;
        break;
      }
    }
    if (!affiliateCode!) throw new Error("Failed to generate unique affiliate code");

    return ctx.db.insert("affiliates", {
      userId: args.userId,
      affiliateCode,
      connectStatus: "pending",
      commissionRate: args.commissionRate,
      isWhitelisted: true,
      createdAt: Date.now(),
    });
  },
});

export const updateConnectStatus = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    connectStatus: v.union(
      v.literal("pending"),
      v.literal("onboarding"),
      v.literal("active"),
      v.literal("restricted"),
    ),
    stripeConnectAccountId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.affiliateId, {
      connectStatus: args.connectStatus,
      ...(args.stripeConnectAccountId && {
        stripeConnectAccountId: args.stripeConnectAccountId,
      }),
    });
  },
});

export const handleInvoicePaid = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    subscriberUserId: v.id("users"),
    stripeInvoiceId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeChargeId: v.string(),
    invoiceAmountCents: v.number(),
    commissionRate: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("affiliateCommissions")
      .withIndex("by_invoice", (q) =>
        q.eq("stripeInvoiceId", args.stripeInvoiceId)
      )
      .unique();
    if (existing) return existing._id;

    const commissionCents = Math.floor(
      (args.invoiceAmountCents * args.commissionRate) / 10_000
    );
    const now = Date.now();
    const availableAt = now + HOLD_MS;

    const commissionId = await ctx.db.insert("affiliateCommissions", {
      affiliateId: args.affiliateId,
      subscriberUserId: args.subscriberUserId,
      stripeInvoiceId: args.stripeInvoiceId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeChargeId: args.stripeChargeId,
      invoiceAmountCents: args.invoiceAmountCents,
      commissionCents,
      status: "held",
      availableAt,
      createdAt: now,
    });

    await ctx.scheduler.runAt(
      availableAt,
      internal.affiliateHelpers.releaseCommission,
      { commissionId }
    );

    return commissionId;
  },
});

/** Scheduled at availableAt — checks conditions then marks "available" and triggers transfer. */
export const releaseCommission = internalMutation({
  args: { commissionId: v.id("affiliateCommissions") },
  handler: async (ctx, args) => {
    const commission = await ctx.db.get(args.commissionId);
    if (!commission || commission.status !== "held") return;

    const affiliate = await ctx.db.get(commission.affiliateId);
    if (!affiliate || !affiliate.isWhitelisted) {
      await ctx.db.patch(args.commissionId, { status: "reversed" });
      return;
    }

    const subscriber = await ctx.db.get(commission.subscriberUserId);
    if (
      !subscriber ||
      subscriber.subscriptionStatus !== "active" ||
      subscriber.subscriptionPlan === "free"
    ) {
      await ctx.db.patch(args.commissionId, { status: "reversed" });
      return;
    }

    await ctx.db.patch(args.commissionId, { status: "available" });

    if (affiliate.connectStatus === "active" && affiliate.stripeConnectAccountId) {
      await ctx.scheduler.runAfter(
        0,
        internal.affiliateStripe.executeTransfer,
        {
          commissionId: args.commissionId,
          affiliateId: affiliate._id,
        }
      );
    }
  },
});

export const handleChargeRefunded = internalMutation({
  args: {
    stripeChargeId: v.string(),
    refundAmountCents: v.number(),
  },
  handler: async (ctx, args) => {
    const commission = await ctx.db
      .query("affiliateCommissions")
      .withIndex("by_charge", (q) =>
        q.eq("stripeChargeId", args.stripeChargeId)
      )
      .unique();
    if (!commission) return;

    if (commission.status === "held") {
      const proportion = args.refundAmountCents / commission.invoiceAmountCents;
      const refundedCommission = Math.floor(
        commission.commissionCents * proportion
      );
      const remaining = commission.commissionCents - refundedCommission;

      if (remaining <= 0 || proportion >= 1) {
        await ctx.db.patch(commission._id, {
          status: "reversed",
          commissionCents: 0,
        });
      } else {
        await ctx.db.patch(commission._id, {
          commissionCents: remaining,
        });
      }
    } else if (commission.status === "transferred") {
      const proportion = args.refundAmountCents / commission.invoiceAmountCents;
      const reverseAmount = Math.floor(
        commission.commissionCents * proportion
      );

      if (reverseAmount > 0 && commission.stripeTransferId) {
        await ctx.scheduler.runAfter(
          0,
          internal.affiliateStripe.reverseTransfer,
          {
            commissionId: commission._id,
            stripeTransferId: commission.stripeTransferId,
            reverseAmountCents: reverseAmount,
          }
        );
      }
    }
  },
});

export const markTransferred = internalMutation({
  args: {
    commissionId: v.id("affiliateCommissions"),
    stripeTransferId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commissionId, {
      status: "transferred",
      transferredAt: Date.now(),
      stripeTransferId: args.stripeTransferId,
    });
  },
});

export const markReversed = internalMutation({
  args: { commissionId: v.id("affiliateCommissions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commissionId, {
      status: "reversed",
      commissionCents: 0,
    });
  },
});

export const listAffiliatesForAdmin = internalQuery({
  handler: async (ctx) => {
    const affiliates = await ctx.db.query("affiliates").collect();
    const results = [];

    for (const aff of affiliates) {
      const user = await ctx.db.get(aff.userId);
      const commissions = await ctx.db
        .query("affiliateCommissions")
        .withIndex("by_affiliate", (q) => q.eq("affiliateId", aff._id))
        .collect();

      const totalEarned = commissions
        .filter((c) => c.status !== "reversed")
        .reduce((sum, c) => sum + c.commissionCents, 0);

      results.push({
        _id: aff._id,
        email: user?.email ?? "unknown",
        affiliateCode: aff.affiliateCode,
        connectStatus: aff.connectStatus,
        isWhitelisted: aff.isWhitelisted,
        totalEarnedCents: totalEarned,
        subscriberCount: new Set(commissions.map((c) => c.subscriberUserId)).size,
        createdAt: aff.createdAt,
      });
    }

    return results;
  },
});

export const updateWhitelist = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    isWhitelisted: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.affiliateId, {
      isWhitelisted: args.isWhitelisted,
    });
  },
});
