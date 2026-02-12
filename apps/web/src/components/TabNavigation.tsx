import { DashboardTab } from "@/hooks/useTokativeEndpoint";

interface TabNavigationProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  postCount: number;
  commentCount: number;
  commenterCount: number;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  postCount,
  commentCount,
  commenterCount,
}: TabNavigationProps) {
  return (
    <div className="relative">
      <div className="flex gap-1 items-end">
        <button
          onClick={() => onTabChange("posts")}
          className={`relative px-5 py-2 text-sm font-medium rounded-t-lg border-t border-l border-r transition-colors ${
            activeTab === "posts"
              ? "bg-surface-elevated text-foreground border-border z-10"
              : "bg-surface-secondary/50 text-foreground-muted border-border hover:text-foreground-secondary hover:bg-surface-secondary"
          }`}
          style={{
            marginBottom: activeTab === "posts" ? "-1px" : "0",
          }}
        >
          Posts
          <span className="ml-2 text-xs text-foreground-muted">
            ({postCount.toLocaleString()})
          </span>
        </button>
        <button
          onClick={() => onTabChange("comments")}
          className={`relative px-5 py-2 text-sm font-medium rounded-t-lg border-t border-l border-r transition-colors ${
            activeTab === "comments"
              ? "bg-surface-elevated text-foreground border-border z-10"
              : "bg-surface-secondary/50 text-foreground-muted border-border hover:text-foreground-secondary hover:bg-surface-secondary"
          }`}
          style={{
            marginBottom: activeTab === "comments" ? "-1px" : "0",
          }}
        >
          Comments
          <span className="ml-2 text-xs text-foreground-muted">
            ({commentCount.toLocaleString()})
          </span>
        </button>
        <button
          onClick={() => onTabChange("commenters")}
          className={`relative px-5 py-2 text-sm font-medium rounded-t-lg border-t border-l border-r transition-colors ${
            activeTab === "commenters"
              ? "bg-surface-elevated text-foreground border-border z-10"
              : "bg-surface-secondary/50 text-foreground-muted border-border hover:text-foreground-secondary hover:bg-surface-secondary"
          }`}
          style={{
            marginBottom: activeTab === "commenters" ? "-1px" : "0",
          }}
        >
          Commenters
          <span className="ml-2 text-xs text-foreground-muted">
            ({commenterCount.toLocaleString()})
          </span>
        </button>
      </div>
      <div className="h-px bg-border" />
    </div>
  );
}
