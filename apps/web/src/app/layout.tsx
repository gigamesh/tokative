import { AuthBridge } from "@/components/AuthBridge";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ConvexClientProvider } from "@/providers/ConvexProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { APP_NAME, BASE_URL } from "@/utils";
import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: `${APP_NAME} - TikTok Engagement Manager | Bulk Reply & Comment Tracker`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Tokative helps TikTok creators manage engagement at scale. Collect comments from any video, send personalized bulk replies, and track your progress in one dashboard.",
  keywords: [
    "tiktok",
    "tiktok comments",
    "tiktok engagement",
    "tiktok manager",
    "bulk reply",
    "comment scraper",
    "tiktok tool",
    "social media management",
  ],
  authors: [{ name: APP_NAME }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} - TikTok Engagement Manager | Bulk Reply & Comment Tracker`,
    description:
      "Tokative helps TikTok creators manage engagement at scale. Collect comments from any video, send personalized bulk replies, and track your progress in one dashboard.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: APP_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} - TikTok Engagement Manager | Bulk Reply & Comment Tracker`,
    description:
      "Tokative helps TikTok creators manage engagement at scale. Collect comments from any video, send personalized bulk replies, and track your progress in one dashboard.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
};

const themeScript = "(function(){var s=localStorage.getItem('tokative-theme');var t=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.add(t)})();";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Tokative",
              url: "https://tokative.social",
              logo: "https://tokative.social/icon128.png",
            }),
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ConvexClientProvider>
            <AuthBridge />
            <Header />
            {children}
            <Footer />
          </ConvexClientProvider>
        </ThemeProvider>
        <Analytics />
        <Toaster
          theme="system"
          position="bottom-right"
          duration={6000}
          toastOptions={{
            className: "!bg-surface-elevated !text-foreground !border-border",
          }}
        />
      </body>
    </html>
  );
}
