"use node";

import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { getStripePriceIds, priceIdToPlanName } from "./plans";
import { REFERRAL_CREDIT } from "./referrals";

function getStripeKey(): string {
  return process.env.STRIPE_SECRET_KEY!;
}

function getStripe(): Stripe {
  return new Stripe(getStripeKey());
}

/** Maps Stripe subscription status to our local status. */
function mapStripeStatus(
  status: Stripe.Subscription.Status,
): "active" | "past_due" | "canceled" | "incomplete" {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return "incomplete";
  }
}

export const createCheckoutSession = action({
  args: {
    clerkId: v.string(),
    plan: v.union(v.literal("pro"), v.literal("premium")),
    interval: v.union(v.literal("month"), v.literal("year")),
    trialDays: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    const user = await ctx.runQuery(internal.stripeHelpers.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user) throw new Error("User not found");

    const stripe = getStripe();
    const priceId = getStripePriceIds(getStripeKey())[args.plan][args.interval];
    let customerId = user.stripeCustomerId;

    if (customerId) {
      const existing = await stripe.customers
        .retrieve(customerId)
        .catch(() => null);
      if (!existing || existing.deleted) {
        customerId = undefined;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { clerkId: args.clerkId },
      });
      customerId = customer.id;
      await ctx.runMutation(internal.stripeHelpers.setStripeCustomerId, {
        userId: user._id,
        stripeCustomerId: customerId,
      });
    }

    const tokativeEndpoint = process.env.TOKATIVE_ENDPOINT!;

    if (user.stripeSubscriptionId && user.subscriptionStatus === "active") {
      const existing = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId,
      );
      if (existing.status === "active") {
        await stripe.subscriptions.update(existing.id, {
          items: [{ id: existing.items.data[0].id, price: priceId }],
          proration_behavior: "create_prorations",
        });
        return { url: `${tokativeEndpoint}/dashboard?checkout=success` };
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${tokativeEndpoint}/dashboard?checkout=success`,
      cancel_url: `${tokativeEndpoint}/pricing`,
      allow_promotion_codes: true,
      ...(args.trialDays
        ? { subscription_data: { trial_period_days: args.trialDays } }
        : {}),
    });

    return { url: session.url };
  },
});

export const createPortalSession = action({
  args: { clerkId: v.string() },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const user = await ctx.runQuery(internal.stripeHelpers.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user || !user.stripeCustomerId) {
      throw new Error("No Stripe customer found");
    }

    const stripe = getStripe();
    const tokativeEndpoint = process.env.TOKATIVE_ENDPOINT!;
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${tokativeEndpoint}/dashboard?tab=settings`,
    });

    return { url: session.url };
  },
});

export const handleWebhook = action({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      args.payload,
      args.signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const user = await ctx.runQuery(
          internal.stripeHelpers.getUserByStripeCustomerId,
          { stripeCustomerId: customerId },
        );
        if (!user) {
          console.error("No user found for Stripe customer:", customerId);
          return;
        }

        const item = subscription.items.data[0];
        const priceId = item?.price?.id ?? "";
        const plan = priceIdToPlanName(priceId);
        const interval = item?.price?.recurring?.interval as
          | "month"
          | "year"
          | undefined;

        // current_period_end moved from subscription to item level in Stripe API 2025-03-31
        const periodEnd =
          ((item as unknown as Record<string, unknown>)?.current_period_end as
            | number
            | undefined) ?? subscription.current_period_end;

        await ctx.runMutation(internal.stripeHelpers.updateSubscription, {
          userId: user._id,
          subscriptionPlan: plan,
          subscriptionStatus: mapStripeStatus(subscription.status),
          stripeSubscriptionId: subscription.id,
          subscriptionPriceId: priceId,
          subscriptionInterval: interval ?? "month",
          currentPeriodEnd: periodEnd * 1000,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        if (
          mapStripeStatus(subscription.status) === "active" &&
          plan !== "free"
        ) {
          const referral = await ctx.runQuery(
            internal.referralHelpers.getReferralByReferred,
            { referredId: user._id },
          );
          if (referral && referral.status === "pending") {
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
            await ctx.scheduler.runAfter(
              SEVEN_DAYS,
              internal.referrals.qualifyReferral,
              { referralId: referral._id },
            );
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;

        const user = await ctx.runQuery(
          internal.stripeHelpers.getUserByStripeCustomerId,
          { stripeCustomerId: customerId },
        );
        if (!user) return;

        await ctx.runMutation(internal.stripeHelpers.updateSubscription, {
          userId: user._id,
          subscriptionPlan: "free",
          subscriptionStatus: "canceled",
          stripeSubscriptionId: subscription.id,
          subscriptionPriceId: "",
          subscriptionInterval: "month",
          currentPeriodEnd: 0,
          cancelAtPeriodEnd: false,
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) return;

        const user = await ctx.runQuery(
          internal.stripeHelpers.getUserByStripeCustomerId,
          { stripeCustomerId: customerId },
        );
        if (!user) return;

        await ctx.runMutation(internal.stripeHelpers.updateSubscription, {
          userId: user._id,
          subscriptionPlan: user.subscriptionPlan ?? "free",
          subscriptionStatus: "past_due",
          stripeSubscriptionId: user.stripeSubscriptionId ?? "",
          subscriptionPriceId: user.subscriptionPriceId ?? "",
          subscriptionInterval: user.subscriptionInterval ?? "month",
          currentPeriodEnd: user.currentPeriodEnd ?? 0,
          cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? false,
        });
        break;
      }
    }
  },
});

/** Creates a one-time 100% discount coupon and applies it to the referrer's subscription. */
export const applyReferralCredit = internalAction({
  args: {
    referralId: v.id("referrals"),
    referrerUserId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await ctx.runQuery(internal.referralHelpers.getUserById, {
      userId: args.referrerUserId,
    });
    if (!user?.stripeSubscriptionId || user.subscriptionStatus !== "active") {
      return;
    }

    const stripe = getStripe();
    const coupon = await stripe.coupons.create({
      amount_off: REFERRAL_CREDIT,
      currency: "usd",
      duration: "once",
      name: `Referral account credit — $${REFERRAL_CREDIT / 100}`,
    });

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      discounts: [{ coupon: coupon.id }],
    });

    await ctx.runMutation(internal.referralHelpers.updateReferralStatus, {
      referralId: args.referralId,
      status: "qualified",
      stripeCouponId: coupon.id,
    });
  },
});
