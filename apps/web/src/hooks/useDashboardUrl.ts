"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/utils/constants";
import { getStorageItem, setStorageItem } from "@/utils/localStorage";

export type DashboardTab = "posts" | "comments" | "commenters" | "settings";

interface DashboardState {
  tab: DashboardTab;
  postId: string | null;
}

const DEFAULT_STATE: DashboardState = { tab: "posts", postId: null };

export function useDashboardUrl() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("posts");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStorageItem<DashboardState>(
      STORAGE_KEYS.DASHBOARD_STATE,
      DEFAULT_STATE
    );
    setActiveTab(stored.tab || "posts");
    setSelectedPostId(stored.postId || null);
  }, []);

  const setTab = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
    setSelectedPostId(null);
    setStorageItem(STORAGE_KEYS.DASHBOARD_STATE, { tab, postId: null });
  }, []);

  const setSelectedPost = useCallback((videoId: string) => {
    setActiveTab("comments");
    setSelectedPostId(videoId);
    setStorageItem(STORAGE_KEYS.DASHBOARD_STATE, {
      tab: "comments",
      postId: videoId,
    });
  }, []);

  const clearPostFilter = useCallback(() => {
    setSelectedPostId(null);
    setStorageItem(STORAGE_KEYS.DASHBOARD_STATE, {
      tab: "comments",
      postId: null,
    });
  }, []);

  return {
    activeTab,
    selectedPostId,
    setTab,
    setSelectedPost,
    clearPostFilter,
  };
}
