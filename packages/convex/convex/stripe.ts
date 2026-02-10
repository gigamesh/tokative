"use node";

import Stripe from "stripe";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { PRICE_ID_TO_PLAN, type PlanName } from "./plans";

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function priceIdToPlan(priceId: string): PlanName {
  return PRICE_ID_TO_PLAN[priceId] ?? "free";
}

/** Maps Stripe subscription status to our local status. */
function mapStripeStatus(
  status: Stripe.Subscription.Status
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
  args: { clerkId: v.string(), priceId: v.string() },
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    const user = await ctx.runQuery(internal.stripeHelpers.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user) throw new Error("User not found");

    const stripe = getStripe();
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

    const dashboardUrl = process.env.DASHBOARD_URL!;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: `${dashboardUrl}/dashboard?checkout=success`,
      cancel_url: `${dashboardUrl}/pricing`,
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
    const dashboardUrl = process.env.DASHBOARD_URL!;
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${dashboardUrl}/dashboard?tab=settings`,
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
      process.env.STRIPE_WEBHOOK_SECRET!
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
          { stripeCustomerId: customerId }
        );
        if (!user) {
          console.error("No user found for Stripe customer:", customerId);
          return;
        }

        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const plan = priceIdToPlan(priceId);
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
          { stripeCustomerId: customerId }
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
          { stripeCustomerId: customerId }
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
        });
        break;
      }
    }
  },
});
