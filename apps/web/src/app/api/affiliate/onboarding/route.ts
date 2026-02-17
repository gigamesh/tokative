import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@tokative/convex";
import { NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await convex.action(api.affiliateStripe.createConnectAccount, {
      clerkId: userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setContext("affiliate_onboarding", { userId });
      Sentry.captureException(error);
    });
    return NextResponse.json(
      { error: "Failed to create Connect account" },
      { status: 500 }
    );
  }
}
