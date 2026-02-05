import { AuthBridge } from "@/components/AuthBridge";
import { Header } from "@/components/Header";
import { ConvexClientProvider } from "@/providers/ConvexProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tokative",
  description: "Manage TikTok interactions - scrape comments and send messages",
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
