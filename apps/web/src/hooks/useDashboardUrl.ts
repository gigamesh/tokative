"use client";

import { useCallback, useEffect, useState } from "react";

export type DashboardTab = "posts" | "comments" | "commenters" | "settings";

const STORAGE_KEY = "tokative-dashboard-state";

interface DashboardState {
  tab: DashboardTab;
  postId: string | null;
}

function loadState(): DashboardState {
  if (typeof window === "undefined") {
    return { tab: "posts", postId: null };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        tab: parsed.tab || "posts",
        postId: parsed.postId || null,
      };
    }
  } catch {
    // Invalid JSON, use defaults
  }
  return { tab: "posts", postId: null };
}

function saveState(state: DashboardState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useDashboardUrl() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("posts");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadState();
    setActiveTab(stored.tab);
    setSelectedPostId(stored.postId);
  }, []);

  const setTab = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
    setSelectedPostId(null);
    saveState({ tab, postId: null });
  }, []);

  const setSelectedPost = useCallback((videoId: string) => {
    setActiveTab("comments");
    setSelectedPostId(videoId);
    saveState({ tab: "comments", postId: videoId });
  }, []);

  const clearPostFilter = useCallback(() => {
    setSelectedPostId(null);
    saveState({ tab: "comments", postId: null });
  }, []);

  return {
    activeTab,
    selectedPostId,
    setTab,
    setSelectedPost,
    clearPostFilter,
  };
}
