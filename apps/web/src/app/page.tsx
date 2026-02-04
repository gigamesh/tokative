"use client";

import { Header } from "@/components/Header";
import { useAuth } from "@/providers/ConvexProvider";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@tokative/convex";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const { userId, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(false);

  const getOrCreate = useMutation(api.users.getOrCreate);
  const accessStatus = useQuery(
    api.users.getAccessStatus,
    userId ? { clerkId: userId } : "skip"
  );

  useEffect(() => {
    const initializeUser = async () => {
      if (!isLoaded || !userId || !user) return;

      const email = user.primaryEmailAddress?.emailAddress;

      if (accessStatus === undefined) {
        return;
      }

      if (accessStatus === null) {
        setIsInitializing(true);
        await getOrCreate({ clerkId: userId, email });
        setIsInitializing(false);
        return;
      }

      if (!accessStatus.isAllowed) {
        router.replace("/not-authorized");
        return;
      }

      if (!accessStatus.hasCompletedOnboarding) {
        router.replace("/onboarding");
        return;
      }

      router.replace("/dashboard");
    };

    initializeUser();
  }, [isLoaded, userId, user, accessStatus, router, getOrCreate]);

  if (!isLoaded || isInitializing) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-foreground-muted">Loading...</div>
      </div>
    );
  }

  if (userId) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-foreground-muted">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-foreground mb-6">Tokative</h1>
          <p className="text-xl text-foreground-muted mb-8 max-w-2xl mx-auto">
            Scrape comments from TikTok videos and manage your engagement. Reply
            to your audience efficiently with bulk messaging tools.
          </p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-lg transition-colors"
          >
            Get Started
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
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </Link>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            }
            title="Scrape Comments"
            description="Collect comments from any TikTok video with the Chrome extension. Filter out spam automatically."
          />
          <FeatureCard
            icon={
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            }
            title="Bulk Reply"
            description="Send personalized replies to multiple comments at once. Save time on engagement."
          />
          <FeatureCard
            icon={
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            }
            title="Track Progress"
            description="See which comments you've replied to. Organize by video and manage your workflow."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-surface-elevated rounded-lg">
      <div className="text-blue-400 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-foreground-muted text-sm">{description}</p>
    </div>
  );
}
