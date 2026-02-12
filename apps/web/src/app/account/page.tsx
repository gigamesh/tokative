import { AccountContent } from "@/components/AccountContent";
import { BILLING_ENABLED } from "@tokative/convex";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Account – Tokative",
  description: "Manage your Tokative subscription and account settings.",
};

export default function AccountPage() {
  if (!BILLING_ENABLED) redirect("/dashboard");
  return <AccountContent />;
}
