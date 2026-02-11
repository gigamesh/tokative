"use node";

import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { getStripePriceIds, priceIdToPlanName, type PlanName } from "./plans";

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
  },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    const user = await ctx.runQuery(internal.stripeHelpers.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user) throw new Error("User not found");

    const stripe = getStripe();
    const priceId = getStripePriceIds(getStripeKey())[args.plan][args.interval];
    let customerId = user.stripeCustomerId;

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

        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const plan = priceIdToPlanName(priceId);
        const interval = subscription.items.data[0]?.price?.recurring
          ?.interval as "month" | "year" | undefined;

        await ctx.runMutation(internal.stripeHelpers.updateSubscription, {
          userId: user._id,
          subscriptionPlan: plan,
          subscriptionStatus: mapStripeStatus(subscription.status),
          stripeSubscriptionId: subscription.id,
          subscriptionPriceId: priceId,
          subscriptionInterval: interval ?? "month",
          currentPeriodEnd: subscription.current_period_end * 1000,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
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
