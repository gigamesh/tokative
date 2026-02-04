
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
              ? "bg-surface-elevated text-foreground border-border z-10"
              : "bg-surface-secondary/50 text-foreground-muted border-white/10 hover:text-foreground-secondary hover:bg-surface-secondary"
          }`}
          style={{
            marginBottom: activeTab === "posts" ? "-1px" : "0",
          }}
        >
          Posts
          <span className="ml-2 text-xs text-foreground-muted">({postCount.toLocaleString()})</span>
        </button>
        <button
          onClick={() => onTabChange("comments")}
          className={`relative px-5 py-2 text-sm font-medium rounded-t-lg border-t border-l border-r transition-colors ${
            activeTab === "comments"
              ? "bg-surface-elevated text-foreground border-border z-10"
              : "bg-surface-secondary/50 text-foreground-muted border-white/10 hover:text-foreground-secondary hover:bg-surface-secondary"
          }`}
          style={{
            marginBottom: activeTab === "comments" ? "-1px" : "0",
          }}
        >
          Comments
          <span className="ml-2 text-xs text-foreground-muted">({commentCount.toLocaleString()})</span>
        </button>
        <button
          onClick={() => onTabChange("settings")}
          className={`relative px-5 py-2 text-sm font-medium rounded-t-lg border-t border-l border-r transition-colors flex items-center gap-2 ${
            activeTab === "settings"
              ? "bg-surface-elevated text-foreground border-border z-10"
              : "bg-surface-secondary/50 text-foreground-muted border-white/10 hover:text-foreground-secondary hover:bg-surface-secondary"
          }`}
          style={{
            marginBottom: activeTab === "settings" ? "-1px" : "0",
          }}
        >
          Settings
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
      <div className="h-px bg-border" />
    </div>
  );
}
