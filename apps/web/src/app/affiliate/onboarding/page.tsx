"use client";

import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";
import { useQuery } from "convex/react";
import { CheckCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

export default function AffiliateOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-content bg-surface flex items-center justify-center">
          <Spinner size="md" />
        </div>
      }
    >
      <AffiliateOnboardingContent />
    </Suspense>
  );
}

function AffiliateOnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userId, isLoaded } = useAuth();
  const isSuccess = searchParams.get("success") === "1";
  const isRefresh = searchParams.get("refresh") === "1";
  const [refreshing, setRefreshing] = useState(false);

  const status = useQuery(
    api.affiliates.getAffiliateStatus,
    isLoaded && userId ? { clerkId: userId } : "skip"
  );

  useEffect(() => {
    if (isRefresh && !refreshing) {
      setRefreshing(true);
      fetch("/api/affiliate/onboarding", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.url) {
            window.location.href = data.url;
          }
        })
        .catch(() => setRefreshing(false));
    }
  }, [isRefresh, refreshing]);

  useEffect(() => {
    if (isSuccess && status?.connectStatus === "active") {
      const timeout = setTimeout(() => router.push("/affiliate"), 2000);
      return () => clearTimeout(timeout);
    }
  }, [isSuccess, status, router]);

  if (!isLoaded || status === undefined || refreshing) {
    return (
      <div className="min-h-content bg-surface flex items-center justify-center">
        <div className="text-center space-y-3">
          <Spinner size="md" />
          <p className="text-foreground-muted">
            {refreshing
              ? "Generating new onboarding link..."
              : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (isSuccess && status?.connectStatus === "active") {
    return (
      <div className="min-h-content bg-surface flex items-center justify-center">
        <div className="text-center space-y-3">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            Payouts Enabled
          </h1>
          <p className="text-foreground-muted">
            Your Stripe Express account is ready. Redirecting to your
            dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-content bg-surface flex items-center justify-center">
        <div className="text-center space-y-3">
          <Spinner size="md" />
          <h1 className="text-xl font-bold text-foreground">
            Verifying your account...
          </h1>
          <p className="text-foreground-muted">
            Waiting for Stripe to confirm your account setup. This may take a
            moment.
          </p>
          <Button variant="outline" onClick={() => router.push("/affiliate")}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-content bg-surface flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-bold text-foreground">
          Affiliate Onboarding
        </h1>
        <p className="text-foreground-muted">
          Something went wrong. Please try again.
        </p>
        <Button variant="secondary" onClick={() => router.push("/affiliate")}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
