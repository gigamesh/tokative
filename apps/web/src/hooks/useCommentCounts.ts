"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";

export function useCommentCounts() {
  const { userId } = useAuth();

  const result = useQuery(
    api.comments.getCountsByVideo,
    userId ? { clerkId: userId } : "skip"
  );

  const commentCountsByVideo = useMemo(() => {
    if (!result) return new Map<string, number>();
    return new Map(Object.entries(result.counts));
  }, [result]);

  return {
    commentCountsByVideo,
    totalCount: result?.totalCount ?? 0,
    loading: result === undefined,
  };
}
