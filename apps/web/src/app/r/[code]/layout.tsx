import { APP_NAME } from "@/utils";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `You've been invited to try ${APP_NAME} Pro — free for 7 days`,
  description: `Join ${APP_NAME} and get 7 days of Pro features free. Manage TikTok engagement at scale.`,
  openGraph: {
    type: "website",
    title: `You've been invited to try ${APP_NAME} Pro — free for 7 days`,
    description: `Join ${APP_NAME} and get 7 days of Pro features free. Manage TikTok engagement at scale.`,
  },
  twitter: {
    card: "summary_large_image",
    title: `You've been invited to try ${APP_NAME} Pro — free for 7 days`,
    description: `Join ${APP_NAME} and get 7 days of Pro features free. Manage TikTok engagement at scale.`,
  },
};

export default function ReferralLayout({ children }: { children: React.ReactNode }) {
  return children;
}
