"use client";

import { useAuth } from "@/providers/ConvexProvider";
import { EXTENSION_SOURCE, MessageType } from "@/utils/constants";
import { useUser } from "@clerk/nextjs";
import { api } from "@tokative/convex";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type CheckState = "checking" | "needs_onboarding" | "redirecting";

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

  if (checkState === "checking" || checkState === "redirecting") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-6">Tokative</h1>
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
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

  return (
    <div className="min-h-screen bg-surface text-balance">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Welcome to Tokative
          </h1>
 <p className="text-foreground-muted">
            If you already installed the Tokative browser extension, enable it
            at{" "}
            <code className="bg-surface-elevated px-2 py-0.5 rounded text-sm select-all">
              chrome://extensions
            </code>
          </p>
        </div>

        <div className="space-y-8">
          <Section number={1} title="Download the Extension">
            <p className="text-foreground-muted mb-4">
              The Tokative Chrome extension allows you to scrape comments and
              send replies directly on TikTok.
            </p>
            <a
              href="/downloads/tokative-extension.zip"
              download
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-brand text-white font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-accent-pink/25"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Extension
            </a>
          </Section>

          <Section number={2} title="Install in Chrome">
            <ol className="space-y-4 text-foreground-muted">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">
                  1
                </span>
                <span>
                  <strong className="text-foreground">Unzip</strong> the
                  downloaded file
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">
                  2
                </span>
                <span>
                  Open Chrome and navigate to{" "}
                  <code className="bg-surface-elevated px-2 py-1 rounded text-sm">
                    chrome://extensions/
                  </code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">
                  3
                </span>
                <span>
                  Enable{" "}
                  <strong className="text-foreground">Developer mode</strong>{" "}
                  (toggle in the top right corner)
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">
                  4
                </span>
                <span>
                  Click{" "}
                  <strong className="text-foreground">Load unpacked</strong> and
                  select the unzipped folder
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">
                  5
                </span>
                <span>
                  <strong className="text-foreground">Pin</strong> the extension
                  to your toolbar for easy access
                </span>
              </li>
            </ol>
          </Section>

          <div className="bg-surface-elevated rounded-lg p-6 text-center">
            <p className="text-foreground mb-4">
              After installing the extension, refresh this page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Refresh Page
            </button>
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
    <div className="bg-surface-elevated rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-8 h-8 bg-blue-600 text-white font-bold rounded-full flex items-center justify-center">
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
