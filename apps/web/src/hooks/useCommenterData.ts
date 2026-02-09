"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";
import { ScrapedComment } from "@/utils/constants";
import { useDebounce } from "./useDebounce";

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
const DEBOUNCE_MS = 300;

export function useCommenterData() {
  const { userId } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, DEBOUNCE_MS);

  const {
    results,
    status,
    loadMore: convexLoadMore,
  } = usePaginatedQuery(
    api.commenters.listPaginated,
    userId
      ? {
          clerkId: userId,
          search: debouncedSearch || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const commenterCount = useQuery(
    api.commenters.getCount,
    userId ? { clerkId: userId } : "skip"
  );

  const loading = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const hasMore = status === "CanLoadMore";

  const commenters = useMemo(() => {
    return (results ?? []) as CommenterData[];
  }, [results]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      convexLoadMore(PAGE_SIZE);
    }
  }, [hasMore, isLoadingMore, convexLoadMore]);

  return {
    commenters,
    loading,
    totalCommenterCount: commenterCount ?? 0,
    hasMore,
    loadMore,
    isLoadingMore,
    search,
    setSearch,
  };
}
