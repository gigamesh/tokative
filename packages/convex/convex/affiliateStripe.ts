"use node";

import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export const createConnectAccount = action({
  args: { clerkId: v.string() },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const user = await ctx.runQuery(internal.stripeHelpers.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user) throw new Error("User not found");

    const affiliate = await ctx.runQuery(
      internal.affiliateHelpers.getAffiliateByUserId,
      { userId: user._id }
    );
    if (!affiliate) throw new Error("Not an affiliate");

    const stripe = getStripe();
    const tokativeEndpoint = process.env.TOKATIVE_ENDPOINT!;

    let accountId = affiliate.stripeConnectAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email ?? undefined,
        metadata: { affiliateId: affiliate._id, clerkId: args.clerkId },
        capabilities: {
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      await ctx.runMutation(internal.affiliateHelpers.updateConnectStatus, {
        affiliateId: affiliate._id,
        connectStatus: "onboarding",
        stripeConnectAccountId: accountId,
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${tokativeEndpoint}/affiliate/onboarding?refresh=1`,
      return_url: `${tokativeEndpoint}/affiliate/onboarding?success=1`,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  },
});

export const refreshOnboardingLink = action({
  args: { clerkId: v.string() },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const user = await ctx.runQuery(internal.stripeHelpers.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user) throw new Error("User not found");

    const affiliate = await ctx.runQuery(
      internal.affiliateHelpers.getAffiliateByUserId,
      { userId: user._id }
    );
    if (!affiliate?.stripeConnectAccountId)
      throw new Error("No Connect account found");

    const stripe = getStripe();
    const tokativeEndpoint = process.env.TOKATIVE_ENDPOINT!;

    const accountLink = await stripe.accountLinks.create({
      account: affiliate.stripeConnectAccountId,
      refresh_url: `${tokativeEndpoint}/affiliate/onboarding?refresh=1`,
      return_url: `${tokativeEndpoint}/affiliate/onboarding?success=1`,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  },
});

export const getExpressDashboardLink = action({
  args: { clerkId: v.string() },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const user = await ctx.runQuery(internal.stripeHelpers.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user) throw new Error("User not found");

    const affiliate = await ctx.runQuery(
      internal.affiliateHelpers.getAffiliateByUserId,
      { userId: user._id }
    );
    if (!affiliate?.stripeConnectAccountId)
      throw new Error("No Connect account found");
    if (affiliate.connectStatus !== "active")
      throw new Error("Connect account not active");

    const stripe = getStripe();
    const loginLink = await stripe.accounts.createLoginLink(
      affiliate.stripeConnectAccountId
    );

    return { url: loginLink.url };
  },
});

export const executeTransfer = internalAction({
  args: {
    commissionId: v.id("affiliateCommissions"),
    affiliateId: v.id("affiliates"),
  },
  handler: async (ctx, args): Promise<void> => {
    const commission = await ctx.runQuery(
      internal.affiliateHelpers.getCommission,
      { commissionId: args.commissionId }
    );
    if (!commission || commission.status !== "available") return;

    const affiliate = await ctx.runQuery(
      internal.affiliateHelpers.getAffiliate,
      { affiliateId: args.affiliateId }
    );
    if (!affiliate?.stripeConnectAccountId) return;

    const stripe = getStripe();
    const transfer = await stripe.transfers.create({
      amount: commission.commissionCents,
      currency: "usd",
      destination: affiliate.stripeConnectAccountId,
      metadata: {
        commissionId: args.commissionId,
        affiliateId: args.affiliateId,
      },
    });

    await ctx.runMutation(internal.affiliateHelpers.markTransferred, {
      commissionId: args.commissionId,
      stripeTransferId: transfer.id,
    });
  },
});

export const reverseTransfer = internalAction({
  args: {
    commissionId: v.id("affiliateCommissions"),
    stripeTransferId: v.string(),
    reverseAmountCents: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const stripe = getStripe();

    try {
      await stripe.transfers.createReversal(args.stripeTransferId, {
        amount: args.reverseAmountCents,
      });
    } catch (e) {
      console.error("Transfer reversal failed:", e);
    }

    await ctx.runMutation(internal.affiliateHelpers.markReversed, {
      commissionId: args.commissionId,
    });
  },
});

export const handleConnectWebhook = action({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      args.payload,
      args.signature,
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
    );

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const affiliate = await ctx.runQuery(
        internal.affiliateHelpers.getAffiliateByConnectAccount,
        { stripeConnectAccountId: account.id }
      );
      if (!affiliate) return;

      let connectStatus: "onboarding" | "active" | "restricted" = "onboarding";
      if (account.payouts_enabled && account.charges_enabled) {
        connectStatus = "active";
      } else if (account.requirements?.disabled_reason) {
        connectStatus = "restricted";
      }

      await ctx.runMutation(internal.affiliateHelpers.updateConnectStatus, {
        affiliateId: affiliate._id,
        connectStatus,
      });
    }
  },
});
