import { ScrapedComment } from "@/utils/constants";
import { useCallback, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { CommentCard } from "./CommentCard";
import { ConfirmationModal } from "./ConfirmationModal";
import { DangerButton } from "./DangerButton";
import { ExpanderRow } from "./ExpanderRow";
import { SearchInput } from "./SearchInput";


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
      <CommentSkeleton />
      <CommentSkeleton />
      <CommentSkeleton />
    </div>
  );
}

interface DisplayComment extends ScrapedComment {
  depth: number;
  isExpander?: boolean;
  expanderCount?: number;
  parentId?: string;
  expanded?: boolean;
}

type FilterStatus = "all" | "replied" | "not_replied" | "failed";
export type SortOption = "newest" | "oldest";

interface CommentTableProps {
  comments: ScrapedComment[];
  selectedIds: Set<string>;
  onSelectComment: (commentId: string, selected: boolean) => void;
  onSelectRange: (commentIds: string[], selected: boolean) => void;
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
  searchingMatchesCommentId?: string | null;
  search: string;
  onSearchChange: (search: string) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  isActive?: boolean;
  translationEnabled?: boolean;
  translatingIds?: Set<string>;
  onTranslateComment?: (commentId: string) => void;
  targetLanguage?: string;
  isDeletingSelected?: boolean;
}

export function CommentTable({
  comments,
  selectedIds,
  onSelectComment,
  onSelectRange,
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
  searchingMatchesCommentId,
  search,
  onSearchChange,
  sort,
  onSortChange,
  isActive = true,
  translationEnabled,
  translatingIds,
  onTranslateComment,
  targetLanguage,
  isDeletingSelected,
}: CommentTableProps) {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    new Set(),
  );
  const lastSelectedIndexRef = useRef<number | null>(null);

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

    const matchesFilterStatus = (comment: ScrapedComment) =>
      filter === "all" ||
      (filter === "replied" && comment.repliedTo) ||
      (filter === "not_replied" && !comment.repliedTo && !comment.replyError) ||
      (filter === "failed" && comment.replyError);

    const filteredTopLevel = topLevel.filter((c) => matchesFilterStatus(c));

    const sortedTopLevel = filteredTopLevel.sort((a, b) => {
      const aTime = a.commentTimestamp
        ? new Date(a.commentTimestamp).getTime()
        : 0;
      const bTime = b.commentTimestamp
        ? new Date(b.commentTimestamp).getTime()
        : 0;
      return sort === "newest" ? bTime - aTime : aTime - bTime;
    });

    const includedParentCommentIds = new Set(
      sortedTopLevel.map((c) => c.commentId).filter(Boolean),
    );

    const childReplies = replies.filter(
      (c) =>
        c.parentCommentId && includedParentCommentIds.has(c.parentCommentId),
    );

    const orphanedReplies = replies.filter(
      (c) =>
        !c.parentCommentId || !includedParentCommentIds.has(c.parentCommentId),
    );

    return [...sortedTopLevel, ...childReplies, ...orphanedReplies];
  }, [comments, filter, sort, videoIdFilter]);

  const displayComments = useMemo((): DisplayComment[] => {
    const topLevel = filteredComments.filter((c) => !c.isReply);
    const parentIdsInList = new Set(
      topLevel.map((c) => c.commentId).filter(Boolean),
    );

    const repliesMap = new Map<string, ScrapedComment[]>();

    const orphanedReplies: ScrapedComment[] = [];

    filteredComments
      .filter((c) => c.isReply)
      .forEach((reply) => {
        if (reply.parentCommentId && parentIdsInList.has(reply.parentCommentId)) {
          if (!repliesMap.has(reply.parentCommentId)) repliesMap.set(reply.parentCommentId, []);
          repliesMap.get(reply.parentCommentId)!.push(reply);
        } else {
          orphanedReplies.push(reply);
        }
      });

    repliesMap.forEach((replies) => {
      replies.sort(
        (a, b) =>
          new Date(a.commentTimestamp || 0).getTime() -
          new Date(b.commentTimestamp || 0).getTime(),
      );
    });

    const result: DisplayComment[] = [];

    for (const parent of topLevel) {
      const replies = repliesMap.get(parent.commentId!) || [];

      result.push({ ...parent, depth: 0, replyCount: replies.length });

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

    for (const orphan of orphanedReplies) {
      result.push({ ...orphan, depth: 0 });
    }

    return result;
  }, [filteredComments, expandedThreads]);

  const handleEndReached = useCallback(() => {
    if (isActive && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [isActive, hasMore, isLoadingMore, onLoadMore]);

  const handleSelectComment = useCallback(
    (
      index: number,
      commentId: string,
      selected: boolean,
      shiftKey: boolean,
    ) => {
      if (shiftKey && lastSelectedIndexRef.current !== null) {
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        const rangeIds: string[] = [];
        for (let i = start; i <= end; i++) {
          const item = displayComments[i];
          if (item && !item.isExpander) {
            rangeIds.push(item.id);
          }
        }
        onSelectRange(rangeIds, selected);
      } else {
        onSelectComment(commentId, selected);
      }
      lastSelectedIndexRef.current = index;
    },
    [displayComments, onSelectComment, onSelectRange],
  );

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
      <div className="sticky top-[130px] z-20 bg-surface-elevated pt-4 space-y-4">
        {headerContent}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap items-center">
            <SearchInput value={search} onChange={onSearchChange} />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterStatus)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent-cyan-muted"
            >
              <option value="all">All</option>
              <option value="not_replied">Not Replied</option>
              <option value="replied">Replied</option>
              <option value="failed">Failed</option>
            </select>

            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent-cyan-muted"
            >
              <option value="newest">Newest Comments</option>
              <option value="oldest">Oldest Comments</option>
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
                className="w-4 h-4 rounded border-border bg-surface-secondary text-accent-cyan-solid focus:ring-accent-cyan-solid"
              />
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : "Select all"}
            </label>
          </div>

          <DangerButton
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={selectedIds.size === 0}
            loading={isDeletingSelected}
            loadingText="Removing"
          >
            Remove{selectedIds.size > 0 && ` (${selectedIds.size})`}
          </DangerButton>
        </div>
      </div>

      {isInitialLoading ? (
        <CommentTableSkeleton count={5} />
      ) : displayComments.length === 0 ? (
        <div className="text-center py-12 text-foreground-muted">
          {search
            ? "No comments match your search."
            : comments.length === 0
              ? "No comments collected yet. Start collecting to see comments here."
              : "No comments match your filter criteria."}
        </div>
      ) : (
        <Virtuoso
          data={displayComments}
          useWindowScroll
          overscan={30}
          increaseViewportBy={{ top: 0, bottom: 800 }}
          endReached={handleEndReached}
          context={{ isLoadingMore, hasMore }}
          components={{
            Footer: StableFooter,
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
                  onSelect={(selected, shiftKey) =>
                    handleSelectComment(index, item.id, selected, shiftKey)
                  }
                  onRemove={() => onRemoveComment(item.id)}
                  onReply={() => onReplyComment(item)}
                  thumbnailUrl={
                    item.videoId ? videoThumbnails.get(item.videoId) : undefined
                  }
                  depth={item.depth}
                  isReplying={replyingCommentId === item.id}
                  isSearchingMatches={searchingMatchesCommentId === item.id}
                  translationEnabled={translationEnabled}
                  isTranslating={translatingIds?.has(item.id)}
                  onTranslate={onTranslateComment ? () => onTranslateComment(item.id) : undefined}
                  targetLanguage={targetLanguage}
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
