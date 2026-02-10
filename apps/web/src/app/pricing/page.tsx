import { PricingContent } from "@/components/PricingContent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing – Tokative",
  description:
    "Simple, transparent pricing for TikTok comment management. Free tier included.",
};

export default function PricingPage() {
  return <PricingContent />;
}
