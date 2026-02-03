import { ScrapedComment } from "@/utils/constants";
import { useCallback, useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { CommentCard } from "./CommentCard";
import { ConfirmationModal } from "./ConfirmationModal";
import { DangerButton } from "./DangerButton";
import { ExpanderRow } from "./ExpanderRow";

export function CommentSkeleton({ depth = 0 }: { depth?: number }) {
  return (
    <div
      className={`bg-surface-elevated rounded-lg p-4 animate-pulse ${depth > 0 ? "ml-8" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-secondary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-24 bg-surface-secondary rounded" />
            <div className="h-3 w-16 bg-surface-secondary rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-surface-secondary rounded" />
            <div className="h-4 w-3/4 bg-surface-secondary rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommentTableSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <CommentSkeleton key={i} />
      ))}
    </div>
  );
}

function LoadingFooter() {
  return (
    <div className="space-y-2 pt-2">
      <CommentSkeleton />
      <CommentSkeleton />
      <CommentSkeleton />
    </div>
  );
}

function EmptyFooter() {
  return null;
}

interface DisplayComment extends ScrapedComment {
  depth: number;
  isExpander?: boolean;
  expanderCount?: number;
  parentId?: string;
  expanded?: boolean;
}

type FilterStatus = "all" | "replied" | "not_replied" | "failed";
type SortOption = "newest" | "oldest" | "recent_scrape";

interface CommentTableProps {
  comments: ScrapedComment[];
  selectedIds: Set<string>;
  onSelectComment: (commentId: string, selected: boolean) => void;
  onSelectFiltered: (commentIds: string[], selected: boolean) => void;
  onRemoveSelected: () => void;
  onRemoveComment: (commentId: string) => void;
  onReplyComment: (comment: ScrapedComment) => void;
  videoIdFilter?: string | null;
  videoThumbnails: Map<string, string>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  isInitialLoading?: boolean;
  replyingCommentId?: string | null;
  headerContent?: React.ReactNode;
}

export function CommentTable({
  comments,
  selectedIds,
  onSelectComment,
  onSelectFiltered,
  onRemoveSelected,
  onRemoveComment,
  onReplyComment,
  videoIdFilter,
  videoThumbnails,
  onLoadMore,
  hasMore,
  isLoadingMore,
  isInitialLoading,
  replyingCommentId,
  headerContent,
}: CommentTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    new Set(),
  );

  const toggleThread = (parentId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  const filteredComments = useMemo(() => {
    const videoFiltered = videoIdFilter
      ? comments.filter((c) => c.videoId === videoIdFilter)
      : comments;

    const topLevel = videoFiltered.filter((c) => !c.isReply);
    const replies = videoFiltered.filter((c) => c.isReply);

    const matchesSearchText = (comment: ScrapedComment) =>
      search === "" ||
      comment.handle.toLowerCase().includes(search.toLowerCase()) ||
      comment.comment.toLowerCase().includes(search.toLowerCase());

    const matchesFilterStatus = (comment: ScrapedComment) =>
      filter === "all" ||
      (filter === "replied" && comment.replySent) ||
      (filter === "not_replied" && !comment.replySent && !comment.replyError) ||
      (filter === "failed" && comment.replyError);

    // Filter and sort only top-level comments based on criteria
    let filteredTopLevel = topLevel.filter(
      (c) => matchesSearchText(c) && matchesFilterStatus(c),
    );

    // If searching, also include parents of matching replies
    if (search !== "") {
      const matchingReplies = replies.filter((c) => matchesSearchText(c));
      const parentIdsOfMatchingReplies = new Set(
        matchingReplies.map((c) => c.parentCommentId).filter(Boolean),
      );
      const additionalParents = topLevel.filter(
        (c) =>
          c.commentId &&
          parentIdsOfMatchingReplies.has(c.commentId) &&
          !filteredTopLevel.some((f) => f.id === c.id),
      );
      filteredTopLevel = [...filteredTopLevel, ...additionalParents];
    }

    // Sort top-level comments
    const sortedTopLevel = filteredTopLevel.sort((a, b) => {
      if (sort === "newest") {
        const aTime = a.commentTimestamp
          ? new Date(a.commentTimestamp).getTime()
          : 0;
        const bTime = b.commentTimestamp
          ? new Date(b.commentTimestamp).getTime()
          : 0;
        return bTime - aTime;
      }
      if (sort === "oldest") {
        const aTime = a.commentTimestamp
          ? new Date(a.commentTimestamp).getTime()
          : 0;
        const bTime = b.commentTimestamp
          ? new Date(b.commentTimestamp).getTime()
          : 0;
        return aTime - bTime;
      }
      return new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime();
    });

    // Build set of parent commentIds that made it through filtering
    const includedParentCommentIds = new Set(
      sortedTopLevel.map((c) => c.commentId).filter(Boolean),
    );

    // Include all replies whose parent is in the filtered set
    const includedReplies = replies.filter(
      (c) =>
        c.parentCommentId && includedParentCommentIds.has(c.parentCommentId),
    );

    return [...sortedTopLevel, ...includedReplies];
  }, [comments, search, filter, sort, videoIdFilter]);

  const displayComments = useMemo((): DisplayComment[] => {
    const topLevel = filteredComments.filter((c) => !c.isReply);
    const repliesMap = new Map<string, ScrapedComment[]>();

    filteredComments
      .filter((c) => c.isReply && c.parentCommentId)
      .forEach((reply) => {
        const parentId = reply.parentCommentId!;
        if (!repliesMap.has(parentId)) repliesMap.set(parentId, []);
        repliesMap.get(parentId)!.push(reply);
      });

    repliesMap.forEach((replies) => {
      replies.sort(
        (a, b) =>
          new Date(a.commentTimestamp || 0).getTime() -
          new Date(b.commentTimestamp || 0).getTime(),
      );
    });

    const result: DisplayComment[] = [];
    const parentIdsInList = new Set(
      topLevel.map((c) => c.commentId).filter(Boolean),
    );

    for (const parent of topLevel) {
      result.push({ ...parent, depth: 0 });

      const replies = repliesMap.get(parent.commentId!) || [];

      if (replies.length > 0) {
        result.push({ ...replies[0], depth: 1 });

        if (replies.length > 1) {
          const isExpanded = expandedThreads.has(parent.commentId!);
          const hiddenScrapedCount = replies.length - 1;

          if (isExpanded) {
            for (let i = 1; i < replies.length; i++) {
              result.push({ ...replies[i], depth: 1 });
            }
            result.push({
              id: `expander-${parent.commentId}`,
              isExpander: true,
              expanderCount: hiddenScrapedCount,
              parentId: parent.commentId!,
              expanded: true,
              depth: 1,
            } as DisplayComment);
          } else {
            result.push({
              id: `expander-${parent.commentId}`,
              isExpander: true,
              expanderCount: hiddenScrapedCount,
              parentId: parent.commentId!,
              expanded: false,
              depth: 1,
            } as DisplayComment);
          }
        }
      }
    }

    return result;
  }, [filteredComments, expandedThreads]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  const filteredSelectedCount = filteredComments.filter((c) =>
    selectedIds.has(c.id),
  ).length;
  const allFilteredSelected =
    filteredComments.length > 0 &&
    filteredSelectedCount === filteredComments.length;
  const someFilteredSelected =
    filteredSelectedCount > 0 &&
    filteredSelectedCount < filteredComments.length;

  return (
    <div className="space-y-4">
      <div className="sticky top-header z-20 bg-surface-elevated pt-4 space-y-4">
        {headerContent}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Search comments..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-2 pr-8 bg-surface-elevated border border-border rounded-lg min-w-80 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:border-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterStatus)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="not_replied">Not Replied</option>
              <option value="replied">Replied</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-blue-500"
            >
              <option value="newest">Newest Comments</option>
              <option value="oldest">Oldest Comments</option>
              <option value="recent_scrape">Recently Scraped</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someFilteredSelected;
                }}
                onChange={(e) => {
                  const filteredIds = filteredComments.map((c) => c.id);
                  onSelectFiltered(filteredIds, e.target.checked);
                }}
                className="w-4 h-4 rounded border-border bg-surface-secondary text-tiktok-red focus:ring-tiktok-red"
              />
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : `Select all (${filteredComments.length})`}
            </label>
          </div>

          <DangerButton
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={selectedIds.size === 0}
          >
            Remove
          </DangerButton>
        </div>
      </div>

      {isInitialLoading ? (
        <CommentTableSkeleton count={5} />
      ) : displayComments.length === 0 ? (
        <div className="text-center py-12 text-foreground-muted">
          {comments.length === 0
            ? "No comments scraped yet. Start scraping to see comments here."
            : "No comments match your search/filter criteria."}
        </div>
      ) : (
        <Virtuoso
          data={displayComments}
          useWindowScroll
          overscan={10}
          endReached={handleEndReached}
          components={{
            Footer: isLoadingMore ? LoadingFooter : EmptyFooter,
          }}
          itemContent={(index, item) => (
            <div className={index > 0 ? "pt-2" : ""}>
              {item.isExpander ? (
                <ExpanderRow
                  count={item.expanderCount!}
                  expanded={item.expanded!}
                  onClick={() => toggleThread(item.parentId!)}
                />
              ) : (
                <CommentCard
                  comment={item}
                  selected={selectedIds.has(item.id)}
                  onSelect={(selected) => onSelectComment(item.id, selected)}
                  onRemove={() => onRemoveComment(item.id)}
                  onReply={() => onReplyComment(item)}
                  thumbnailUrl={
                    item.videoId ? videoThumbnails.get(item.videoId) : undefined
                  }
                  depth={item.depth}
                  isReplying={replyingCommentId === item.id}
                />
              )}
            </div>
          )}
        />
      )}

      <ConfirmationModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={onRemoveSelected}
        title="Delete selected comments?"
        message={`Are you sure you want to delete ${selectedIds.size} selected comment${selectedIds.size > 1 ? "s" : ""}? This action cannot be undone (your TikTok account will not be affected).`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
