"use client";

import { LinkButton } from "@/components/Button";
import { useAuth } from "@/providers/ConvexProvider";
import { useUser } from "@clerk/nextjs";
import { api } from "@tokative/convex";
import { useMutation, useQuery } from "convex/react";
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
    userId ? { clerkId: userId } : "skip",
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
      <div className="min-h-content bg-surface flex justify-center pt-[20vh]">
        <div className="w-5 h-5 border-2 border-foreground-muted/30 border-t-foreground-muted rounded-full animate-spin" />
      </div>
    );
  }

  if (userId) {
    return (
      <div className="min-h-content bg-surface flex justify-center pt-[20vh]">
        <div className="w-5 h-5 border-2 border-foreground-muted/30 border-t-foreground-muted rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface overflow-hidden">
      <main className="max-w-5xl mx-auto px-6 relative">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-r from-accent-cyan/20 via-transparent to-accent-pink/20 blur-3xl rounded-full pointer-events-none" />

        <section className="pt-32 pb-16 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-6xl sm:text-7xl font-bold tracking-tight">
              <span className="text-gradient-brand">Tokative</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-foreground-muted leading-relaxed max-w-xl mx-auto text-balance">
              Manage TikTok engagement at scale. Collect comments, reply in
              bulk, and track everything in one place.
            </p>
            <div className="mt-10">
              <LinkButton
                href="/sign-in"
                variant="primary"
                size="lg"
                pill
                className="group hover:scale-105"
              >
                Get Started
                <svg
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </LinkButton>
            </div>
          </div>
        </section>

        <section className="py-8 relative">
          <div className="grid sm:grid-cols-3 gap-16 sm:gap-12">
            <FeatureCard
              number="01"
              title="Collect"
              description="Gather comments from any TikTok video with our Chrome extension. Automatic spam filtering included."
              accent="cyan"
            />
            <FeatureCard
              number="02"
              title="Reply"
              description="Send personalized responses to multiple comments at once. Engage your audience efficiently."
              accent="pink"
            />
            <FeatureCard
              number="03"
              title="Track"
              description="Monitor your progress across videos. See what you've replied to and what's pending."
              accent="cyan"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  number,
  title,
  description,
  accent,
}: {
  number: string;
  title: string;
  description: string;
  accent: "cyan" | "pink";
}) {
  const accentColor = accent === "cyan" ? "text-accent-cyan" : "text-accent-pink";

  return (
    <div className="group">
      <div className="text-center">
        <span className={`text-xs font-mono ${accentColor}`}>{number}</span>
        <h3 className="mt-2 text-lg font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mt-3 text-foreground-muted leading-relaxed text-center">
        {description}
      </p>
    </div>
  );
}
