import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api, BILLING_ENABLED } from "@tokative/convex";
import { NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  if (!BILLING_ENABLED) {
    return NextResponse.json({ error: "Billing is not enabled" }, { status: 404 });
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await convex.action(api.stripe.createPortalSession, {
      clerkId: userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setContext("portal", { userId });
      Sentry.captureException(error);
    });
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
