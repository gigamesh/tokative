"use client";

import { Button, LinkButton } from "@/components/Button";
import { useAuth } from "@/providers/ConvexProvider";
import { EXTENSION_SOURCE, MessageType } from "@/utils/constants";
import { useUser } from "@clerk/nextjs";
import { api } from "@tokative/convex";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type CheckState = "checking" | "needs_onboarding" | "redirecting";

type BrowserCheck = {
  isChrome: boolean;
  isDesktop: boolean;
};

function checkBrowserRequirements(): BrowserCheck {
  if (typeof window === "undefined") {
    return { isChrome: true, isDesktop: true };
  }

  const ua = navigator.userAgent;

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isDesktop = !isMobile;

  const isChromium = /Chrome|Chromium|Edg|OPR|Brave/i.test(ua) && !/Safari/i.test(ua) ||
                     (/Chrome/i.test(ua) && /Safari/i.test(ua));
  const isChrome = isChromium && !(/Edg|OPR|Brave/i.test(ua));

  return { isChrome: isChromium, isDesktop };
}

export default function OnboardingPage() {
  const { userId, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const getOrCreate = useMutation(api.users.getOrCreate);
  const markComplete = useMutation(api.users.markOnboardingComplete);
  const accessStatus = useQuery(
    api.users.getAccessStatus,
    userId ? { clerkId: userId } : "skip",
  );

  const [checkState, setCheckState] = useState<CheckState>("checking");
  const [browserCheck, setBrowserCheck] = useState<BrowserCheck | null>(null);

  useEffect(() => {
    setBrowserCheck(checkBrowserRequirements());
  }, []);

  const completeAndRedirect = useCallback(async () => {
    if (!userId) return;
    setCheckState("redirecting");
    try {
      await markComplete({ clerkId: userId });
    } catch (e) {
      // Ignore - user might already be marked complete
    }
    router.replace("/dashboard");
  }, [userId, markComplete, router]);

  useEffect(() => {
    const init = async () => {
      if (!isLoaded || !userId || !user) return;

      const email = user.primaryEmailAddress?.emailAddress;

      if (accessStatus === undefined) return;

      // Always call getOrCreate to ensure email is stored/updated
      await getOrCreate({ clerkId: userId, email });

      // If user was just created, wait for accessStatus to update
      if (accessStatus === null) {
        return;
      }

      // Re-check whitelist with the stored email
      if (!accessStatus.isAllowed && accessStatus.email !== email) {
        // Email mismatch - wait for next query cycle after getOrCreate updates it
        return;
      }

      if (!accessStatus.isAllowed) {
        router.replace("/not-authorized");
        return;
      }

      // Always check for extension - only go to dashboard if connected
      let extensionFound = false;

      const handleMessage = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data?.source !== EXTENSION_SOURCE) return;
        extensionFound = true;
      };

      window.addEventListener("message", handleMessage);
      window.postMessage({ type: MessageType.CHECK_BRIDGE }, "*");

      // Wait up to 2 seconds for extension response
      await new Promise((resolve) => setTimeout(resolve, 2000));

      window.removeEventListener("message", handleMessage);

      if (extensionFound) {
        await completeAndRedirect();
      } else {
        setCheckState("needs_onboarding");
      }
    };

    init();
  }, [
    isLoaded,
    userId,
    user,
    accessStatus,
    router,
    getOrCreate,
    completeAndRedirect,
  ]);

  // Keep listening for extension while showing onboarding
  useEffect(() => {
    if (checkState !== "needs_onboarding") return;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.source !== EXTENSION_SOURCE) return;
      completeAndRedirect();
    };

    window.addEventListener("message", handleMessage);

    // Poll every 2 seconds
    const interval = setInterval(() => {
      window.postMessage({ type: MessageType.CHECK_BRIDGE }, "*");
    }, 2000);

    // Initial check
    window.postMessage({ type: MessageType.CHECK_BRIDGE }, "*");

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, [checkState, completeAndRedirect]);

  const showBrowserWarningLoading = browserCheck && (!browserCheck.isChrome || !browserCheck.isDesktop);

  if (checkState === "checking" || checkState === "redirecting") {
    return (
      <div className="min-h-content bg-surface flex flex-col items-center pt-[20vh] p-4">
        {showBrowserWarningLoading && (
          <div className="mb-8 max-w-md p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-500">
                  {!browserCheck.isDesktop
                    ? "Desktop browser required"
                    : "Google Chrome required"}
                </p>
                <p className="text-sm text-foreground-muted mt-1">
                  {!browserCheck.isDesktop
                    ? "Tokative requires a desktop browser to install the Chrome extension. Please visit this page on your computer."
                    : "Tokative requires Google Chrome (or a Chromium-based browser like Edge or Brave) to install the extension."}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
            <span className="text-gradient-brand">Tokative</span>
          </h1>
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-accent-pink border-t-transparent rounded-full animate-spin" />
            <span className="text-foreground-muted">
              {checkState === "redirecting"
                ? "Taking you to the dashboard..."
                : "Setting things up..."}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const showBrowserWarning = browserCheck && (!browserCheck.isChrome || !browserCheck.isDesktop);

  return (
    <div className="min-h-content bg-surface text-balance">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {showBrowserWarning && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-500">
                  {!browserCheck.isDesktop
                    ? "Desktop browser required"
                    : "Google Chrome required"}
                </p>
                <p className="text-sm text-foreground-muted mt-1">
                  {!browserCheck.isDesktop
                    ? "Tokative requires a desktop browser to install the Chrome extension. Please visit this page on your computer."
                    : "Tokative requires Google Chrome (or a Chromium-based browser like Edge or Brave) to install the extension."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-6">
          <p className="text-foreground-muted mb-1">Welcome to</p>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-2">
            <span className="text-gradient-brand">Tokative</span>
          </h1>
          <p className="text-foreground-muted">
            If you already installed the extension, enable it at{" "}
            <code className="bg-surface-elevated px-2 py-0.5 rounded text-sm select-all">
              chrome://extensions
            </code>
          </p>
        </div>

        <div className="space-y-4">
          <Section number={1} title="Download the Extension">
            <p className="text-foreground-muted mb-3">
              The Chrome extension lets you scrape comments and send replies on
              TikTok.
            </p>
            <LinkButton
              href="/downloads/tokative-extension.zip"
              download
              variant="primary"
              size="lg"
            >
              <Download className="w-5 h-5" />
              Download Extension
            </LinkButton>
          </Section>

          <Section number={2} title="Install in Chrome">
            <ol className="space-y-2 text-foreground-muted ml-4">
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 border border-foreground-muted text-foreground-muted text-sm rounded-full flex items-center justify-center">
                  1
                </span>
                <span>
                  <strong className="text-foreground">Unzip</strong> the
                  downloaded file
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 border border-foreground-muted text-foreground-muted text-sm rounded-full flex items-center justify-center">
                  2
                </span>
                <span>
                  Open{" "}
                  <code className="bg-surface-elevated px-1.5 py-0.5 rounded text-sm">
                    chrome://extensions/
                  </code>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 border border-foreground-muted text-foreground-muted text-sm rounded-full flex items-center justify-center">
                  3
                </span>
                <span>
                  Enable{" "}
                  <strong className="text-foreground">Developer mode</strong>{" "}
                  (top right toggle)
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 border border-foreground-muted text-foreground-muted text-sm rounded-full flex items-center justify-center">
                  4
                </span>
                <span>
                  Click{" "}
                  <strong className="text-foreground">Load unpacked</strong> and
                  select the unzipped folder
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 border border-foreground-muted text-foreground-muted text-sm rounded-full flex items-center justify-center">
                  5
                </span>
                <span>
                  <strong className="text-foreground">Pin</strong> the extension
                  to your toolbar
                </span>
              </li>
            </ol>
          </Section>

          <div className="bg-surface-elevated rounded-lg p-4 text-center">
            <p className="text-foreground mb-3">
              After installing the extension, refresh this page to continue.
            </p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-elevated rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 bg-accent-cyan-solid text-white font-bold rounded-full flex items-center justify-center">
          {number}
        </span>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <h3 className="font-medium text-foreground mb-1">{question}</h3>
      <p className="text-foreground-muted text-sm">{answer}</p>
    </div>
  );
}
