"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tiktok-buddy/convex";

export function useUser() {
  const { userId, isLoaded } = useAuth();
  const ensureUser = useMutation(api.users.getOrCreate);

  useEffect(() => {
    if (isLoaded && userId) {
      ensureUser({
        clerkId: userId,
      }).catch(console.error);
    }
  }, [isLoaded, userId, ensureUser]);

  return {
    userId,
    isLoaded,
    isSignedIn: !!userId,
  };
}
