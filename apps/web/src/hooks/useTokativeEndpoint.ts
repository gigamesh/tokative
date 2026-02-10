"use client";

import { STORAGE_KEYS } from "@/utils/constants";
import { getStorageItem, setStorageItem } from "@/utils/localStorage";
import { useCallback, useEffect, useRef, useState } from "react";

export type DashboardTab = "posts" | "comments" | "commenters";

interface DashboardState {
  tab: DashboardTab;
  postId: string | null;
}

const DEFAULT_STATE: DashboardState = { tab: "posts", postId: null };

export function useTokativeEndpoint() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("posts");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const activeTabRef = useRef<DashboardTab>(activeTab);
  const scrollPositions = useRef<Map<DashboardTab, number>>(new Map());

  activeTabRef.current = activeTab;

  useEffect(() => {
    const stored = getStorageItem<DashboardState>(
      STORAGE_KEYS.DASHBOARD_STATE,
      DEFAULT_STATE,
    );
    const validTabs: DashboardTab[] = ["posts", "comments", "commenters"];
    setActiveTab(
      validTabs.includes(stored.tab as DashboardTab)
        ? (stored.tab as DashboardTab)
        : "posts",
    );
    setSelectedPostId(stored.postId || null);
  }, []);

  useEffect(() => {
    const savedPosition = scrollPositions.current.get(activeTab) ?? 0;
    if (savedPosition > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedPosition });
      });
    }
  }, [activeTab]);

  const saveScrollAndReset = useCallback(() => {
    scrollPositions.current.set(activeTabRef.current, window.scrollY);
    window.scrollTo({ top: 0 });
  }, []);

  const setTab = useCallback(
    (tab: DashboardTab) => {
      saveScrollAndReset();
      setActiveTab(tab);
      setSelectedPostId(null);
      setStorageItem(STORAGE_KEYS.DASHBOARD_STATE, { tab, postId: null });
    },
    [saveScrollAndReset],
  );

  const setSelectedPost = useCallback(
    (videoId: string) => {
      saveScrollAndReset();
      setActiveTab("comments");
      setSelectedPostId(videoId);
      setStorageItem(STORAGE_KEYS.DASHBOARD_STATE, {
        tab: "comments",
        postId: videoId,
      });
    },
    [saveScrollAndReset],
  );

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
