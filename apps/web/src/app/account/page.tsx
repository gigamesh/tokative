import { AccountContent } from "@/components/AccountContent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account – Tokative",
  description: "Manage your Tokative subscription and account settings.",
};

export default function AccountPage() {
  return <AccountContent />;
}
