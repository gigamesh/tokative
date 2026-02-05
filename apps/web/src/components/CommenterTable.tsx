import { ScrapedComment } from "@/utils/constants";
import { useCallback, useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { CommenterCard } from "./CommenterCard";
import { ConfirmationModal } from "./ConfirmationModal";
import { DangerButton } from "./DangerButton";
import { CommenterData } from "@/hooks/useCommenterData";

function CommenterSkeleton() {
  return (
    <div className="bg-surface-elevated rounded-lg p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-4 h-4 rounded bg-surface-secondary flex-shrink-0 mt-2" />
        <div className="w-10 h-10 rounded-full bg-surface-secondary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-24 bg-surface-secondary rounded" />
            <div className="h-5 w-20 bg-surface-secondary rounded-full" />
            <div className="h-3 w-16 bg-surface-secondary rounded" />
          </div>
          <div className="h-4 w-3/4 bg-surface-secondary rounded" />
        </div>
        <div className="w-8 h-8 bg-surface-secondary rounded-lg" />
      </div>
    </div>
  );
}

export function CommenterTableSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <CommenterSkeleton key={i} />
      ))}
    </div>
  );
}

function LoadingFooter() {
  return (
    <div className="space-y-2 pt-2">
      <CommenterSkeleton />
      <CommenterSkeleton />
      <CommenterSkeleton />
    </div>
  );
}

function EmptyFooter() {
  return null;
}

interface CommenterTableProps {
  commenters: CommenterData[];
  selectedCommentIds: Set<string>;
  onSelectComment: (commentId: string, selected: boolean) => void;
  onRemoveSelected: () => void;
  onRemoveComment: (commentId: string) => void;
  onReplyComment: (comment: ScrapedComment) => void;
  videoThumbnails: Map<string, string>;
  isLoading?: boolean;
  replyingCommentId?: string | null;
  searchingMatchesCommentId?: string | null;
  headerContent?: React.ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function CommenterTable({
  commenters,
  selectedCommentIds,
  onSelectComment,
  onRemoveSelected,
  onRemoveComment,
  onReplyComment,
  videoThumbnails,
  isLoading,
  replyingCommentId,
  searchingMatchesCommentId,
  headerContent,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: CommenterTableProps) {
  const [search, setSearch] = useState("");
  const [expandedCommenterIds, setExpandedCommenterIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const toggleExpanded = useCallback((profileId: string) => {
    setExpandedCommenterIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  }, []);

  const filteredCommenters = useMemo(() => {
    if (!search) return commenters;
    const searchLower = search.toLowerCase();
    return commenters.filter((c) =>
      c.handle.toLowerCase().includes(searchLower)
    );
  }, [commenters, search]);

  const filteredCommentIds = useMemo(() => {
    const ids: string[] = [];
    for (const commenter of filteredCommenters) {
      for (const comment of commenter.comments) {
        ids.push(comment.id);
      }
    }
    return ids;
  }, [filteredCommenters]);

  const filteredSelectedCount = filteredCommentIds.filter((id) =>
    selectedCommentIds.has(id)
  ).length;

  const allFilteredSelected =
    filteredCommentIds.length > 0 &&
    filteredSelectedCount === filteredCommentIds.length;

  const someFilteredSelected =
    filteredSelectedCount > 0 &&
    filteredSelectedCount < filteredCommentIds.length;

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      for (const id of filteredCommentIds) {
        onSelectComment(id, checked);
      }
    },
    [filteredCommentIds, onSelectComment]
  );

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore && onLoadMore && !search) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore, search]);

  return (
    <div className="space-y-4">
      <div className="sticky top-header z-20 bg-surface-elevated pt-4 space-y-4">
        {headerContent}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by handle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-3 py-2 pr-8 bg-surface-elevated border border-border rounded-lg min-w-80 text-sm text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent-cyan-muted"
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
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-surface-secondary text-accent-cyan-solid focus:ring-accent-cyan-solid"
              />
              {selectedCommentIds.size > 0
                ? `${selectedCommentIds.size} selected`
                : "Select all"}
            </label>
          </div>

          <DangerButton
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={selectedCommentIds.size === 0}
          >
            Remove
          </DangerButton>
        </div>
      </div>

      {isLoading ? (
        <CommenterTableSkeleton count={5} />
      ) : filteredCommenters.length === 0 ? (
        <div className="text-center py-12 text-foreground-muted">
          {commenters.length === 0
            ? "No comments scraped yet. Start scraping to see commenters here."
            : "No commenters match your search."}
        </div>
      ) : (
        <Virtuoso
          data={filteredCommenters}
          useWindowScroll
          overscan={10}
          endReached={handleEndReached}
          components={{
            Footer: isLoadingMore ? LoadingFooter : EmptyFooter,
          }}
          itemContent={(index, commenter) => (
            <div className={index > 0 ? "pt-2" : ""}>
              <CommenterCard
                commenter={commenter}
                expanded={expandedCommenterIds.has(commenter.profileId)}
                onToggleExpand={() => toggleExpanded(commenter.profileId)}
                selectedCommentIds={selectedCommentIds}
                onSelectComment={onSelectComment}
                onRemoveComment={onRemoveComment}
                onReplyComment={onReplyComment}
                videoThumbnails={videoThumbnails}
                replyingCommentId={replyingCommentId}
                searchingMatchesCommentId={searchingMatchesCommentId}
              />
            </div>
          )}
        />
      )}

      <ConfirmationModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={onRemoveSelected}
        title="Delete selected comments?"
        message={`Are you sure you want to delete ${selectedCommentIds.size} selected comment${selectedCommentIds.size > 1 ? "s" : ""}? This action cannot be undone (your TikTok account will not be affected).`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
