import { AuthBridge } from "@/components/AuthBridge";
import { Header } from "@/components/Header";
import { ConvexClientProvider } from "@/providers/ConvexProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { APP_NAME, BASE_URL } from "@/utils";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: `${APP_NAME} - TikTok Engagement Manager`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Manage TikTok engagement at scale. Collect comments, reply in bulk, and track everything in one place.",
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
    title: `${APP_NAME} - TikTok Engagement Manager`,
    description:
      "Manage TikTok engagement at scale. Collect comments, reply in bulk, and track everything.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: APP_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} - TikTok Engagement Manager`,
    description: "Manage TikTok engagement at scale.",
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
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ConvexClientProvider>
            <AuthBridge />
            <Header />
            {children}
          </ConvexClientProvider>
        </ThemeProvider>
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
