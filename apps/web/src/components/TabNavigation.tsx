"use client";

import { DashboardTab } from "@/hooks/useDashboardUrl";

interface TabNavigationProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  postCount: number;
  commentCount: number;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  postCount,
  commentCount,
}: TabNavigationProps) {
  return (
    <div className="relative">
      <div className="flex gap-1 items-end">
        <button
          onClick={() => onTabChange("posts")}
          className={`relative px-5 py-2 text-sm font-medium rounded-t-lg border-t border-l border-r transition-colors ${
            activeTab === "posts"
              ? "bg-tiktok-gray text-white border-gray-700 z-10"
              : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:text-gray-300 hover:bg-gray-800"
          }`}
          style={{
            marginBottom: activeTab === "posts" ? "-1px" : "0",
          }}
        >
          Posts
          <span className="ml-2 text-xs text-gray-500">({postCount})</span>
        </button>
        <button
          onClick={() => onTabChange("comments")}
          className={`relative px-5 py-2 text-sm font-medium rounded-t-lg border-t border-l border-r transition-colors ${
            activeTab === "comments"
              ? "bg-tiktok-gray text-white border-gray-700 z-10"
              : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:text-gray-300 hover:bg-gray-800"
          }`}
          style={{
            marginBottom: activeTab === "comments" ? "-1px" : "0",
          }}
        >
          Comments
          <span className="ml-2 text-xs text-gray-500">({commentCount})</span>
        </button>
      </div>
      <div className="h-px bg-gray-700" />
    </div>
  );
}
