"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";

export function useCommentCounts() {
  const { userId } = useAuth();

  const countsRecord = useQuery(
    api.comments.getCountsByVideo,
    userId ? { clerkId: userId } : "skip"
  );

  const commentCountsByVideo = useMemo(() => {
    if (!countsRecord) return new Map<string, number>();
    return new Map(Object.entries(countsRecord));
  }, [countsRecord]);

  return {
    commentCountsByVideo,
    loading: countsRecord === undefined,
  };
}
