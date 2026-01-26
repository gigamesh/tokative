"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export type DashboardTab = "posts" | "comments";

export function useDashboardUrl() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = useMemo<DashboardTab>(() => {
    const tab = searchParams.get("tab");
    return tab === "comments" ? "comments" : "posts";
  }, [searchParams]);

  const selectedPostId = useMemo<string | null>(() => {
    return searchParams.get("post");
  }, [searchParams]);

  const setTab = useCallback(
    (tab: DashboardTab) => {
      const params = new URLSearchParams();
      if (tab !== "posts") {
        params.set("tab", tab);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  const setSelectedPost = useCallback(
    (videoId: string) => {
      const params = new URLSearchParams();
      params.set("tab", "comments");
      params.set("post", videoId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname]
  );

  const clearPostFilter = useCallback(() => {
    const params = new URLSearchParams();
    params.set("tab", "comments");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname]);

  return {
    activeTab,
    selectedPostId,
    setTab,
    setSelectedPost,
    clearPostFilter,
  };
}
