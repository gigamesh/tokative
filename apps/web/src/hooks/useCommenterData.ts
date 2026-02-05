"use client";

import { useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";
import { ScrapedComment } from "@/utils/constants";

export interface CommenterData {
  profileId: string;
  tiktokUserId: string;
  handle: string;
  profileUrl: string;
  avatarUrl?: string;
  commentCount: number;
  mostRecentCommentAt: number;
  comments: ScrapedComment[];
}

const PAGE_SIZE = 30;

export function useCommenterData() {
  const { userId } = useAuth();
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const allCommenters = useQuery(
    api.commenters.list,
    userId ? { clerkId: userId } : "skip"
  ) as CommenterData[] | undefined;

  const loading = allCommenters === undefined;
  const totalCommenterCount = allCommenters?.length ?? 0;

  const commenters = useMemo(() => {
    if (!allCommenters) return [];
    return allCommenters.slice(0, displayCount);
  }, [allCommenters, displayCount]);

  const hasMore = allCommenters ? displayCount < allCommenters.length : false;

  const loadMore = useCallback(() => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  }, []);

  return {
    commenters,
    loading,
    totalCommenterCount,
    hasMore,
    loadMore,
    isLoadingMore: false,
  };
}
