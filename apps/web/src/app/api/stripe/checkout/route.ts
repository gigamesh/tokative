import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api, BILLING_ENABLED } from "@tokative/convex";
import { NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  if (!BILLING_ENABLED) {
    return NextResponse.json({ error: "Billing is not enabled" }, { status: 404 });
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan, interval } = await request.json();
  if (!plan || !interval) {
    return NextResponse.json({ error: "Missing plan or interval" }, { status: 400 });
  }

  try {
    const result = await convex.action(api.stripe.createCheckoutSession, {
      clerkId: userId,
      plan,
      interval,
    });

    return NextResponse.json(result);
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setContext("checkout", { userId, plan, interval });
      Sentry.captureException(error);
    });
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
