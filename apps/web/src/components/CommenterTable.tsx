import { CommenterData } from "@/hooks/useCommenterData";
import { ScrapedComment } from "@/utils/constants";
import { useCallback, useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { CommenterCard } from "./CommenterCard";
import { ConfirmationModal } from "./ConfirmationModal";
import { DangerButton } from "./DangerButton";
import { SearchInput } from "./SearchInput";

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

interface FooterContext {
  isLoadingMore?: boolean;
  hasMore?: boolean;
}

function StableFooter({ context }: { context?: FooterContext }) {
  if (!context?.hasMore) return null;

  return (
    <div
      className={`space-y-2 pt-2 ${context.isLoadingMore ? "" : "invisible"}`}
    >
      <CommenterSkeleton />
      <CommenterSkeleton />
      <CommenterSkeleton />
    </div>
  );
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
  search: string;
  onSearchChange: (search: string) => void;
  translationEnabled?: boolean;
  translatingIds?: Set<string>;
  onTranslateComment?: (commentId: string) => void;
  targetLanguage?: string;
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
  search,
  onSearchChange,
  translationEnabled,
  translatingIds,
  onTranslateComment,
  targetLanguage,
}: CommenterTableProps) {
  const [expandedCommenterIds, setExpandedCommenterIds] = useState<Set<string>>(
    new Set(),
  );
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

  const allCommentIds = useMemo(() => {
    const ids: string[] = [];
    for (const commenter of commenters) {
      for (const comment of commenter.comments) {
        ids.push(comment.id);
      }
    }
    return ids;
  }, [commenters]);

  const selectedCount = allCommentIds.filter((id) =>
    selectedCommentIds.has(id),
  ).length;

  const allSelected =
    allCommentIds.length > 0 && selectedCount === allCommentIds.length;

  const someSelected =
    selectedCount > 0 && selectedCount < allCommentIds.length;

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      for (const id of allCommentIds) {
        onSelectComment(id, checked);
      }
    },
    [allCommentIds, onSelectComment],
  );

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  return (
    <div className="space-y-4">
      <div className="sticky top-[130px] z-20 bg-surface-elevated pt-4 space-y-4">
        {headerContent}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap items-center">
            <SearchInput value={search} onChange={onSearchChange} />

          </div>
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
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
      ) : commenters.length === 0 ? (
        <div className="text-center py-12 text-foreground-muted">
          {search
            ? "No commenters match your search."
            : "No comments collected yet. Start collecting to see commenters here."}
        </div>
      ) : (
        <Virtuoso
          data={commenters}
          useWindowScroll
          overscan={30}
          increaseViewportBy={{ top: 0, bottom: 800 }}
          endReached={handleEndReached}
          context={{ isLoadingMore, hasMore }}
          components={{
            Footer: StableFooter,
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
                translationEnabled={translationEnabled}
                translatingIds={translatingIds}
                onTranslateComment={onTranslateComment}
                targetLanguage={targetLanguage}
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
