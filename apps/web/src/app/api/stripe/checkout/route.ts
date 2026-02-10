import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@tokative/convex";
import { NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceId } = await request.json();
  if (!priceId || typeof priceId !== "string") {
    return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
  }

  const result = await convex.action(api.stripe.createCheckoutSession, {
    clerkId: userId,
    priceId,
  });

  return NextResponse.json(result);
}
