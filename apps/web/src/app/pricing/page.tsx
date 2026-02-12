import { PricingContent } from "@/components/PricingContent";
import { BILLING_ENABLED } from "@tokative/convex";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Pricing – Tokative",
  description:
    "Tokative pricing for TikTok comment management. Free tier included.",
};

export default function PricingPage() {
  if (!BILLING_ENABLED) redirect("/");
  return <PricingContent />;
}
