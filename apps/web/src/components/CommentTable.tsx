import { ScrapedComment } from "@/utils/constants";
import { useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { CommentCard } from "./CommentCard";
import { ConfirmationModal } from "./ConfirmationModal";
import { ExpanderRow } from "./ExpanderRow";

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
    const filtered = comments.filter((comment) => {
      if (videoIdFilter && comment.videoId !== videoIdFilter) {
        return false;
      }

      const matchesSearch =
        search === "" ||
        comment.handle.toLowerCase().includes(search.toLowerCase()) ||
        comment.comment.toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === "all" ||
        (filter === "replied" && comment.replySent) ||
        (filter === "not_replied" &&
          !comment.replySent &&
          !comment.replyError) ||
        (filter === "failed" && comment.replyError);

      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a, b) => {
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

    const orphanReplies = filteredComments.filter(
      (c) =>
        c.isReply &&
        c.parentCommentId &&
        !parentIdsInList.has(c.parentCommentId),
    );
    for (const orphan of orphanReplies) {
      result.push({ ...orphan, depth: 1 });
    }

    return result;
  }, [filteredComments, expandedThreads]);

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
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {" "}
        <div className="flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder="Search comments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 bg-tiktok-gray border border-gray-700 rounded-lg min-w-80 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterStatus)}
            className="px-3 py-2 bg-tiktok-gray border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-tiktok-red"
          >
            <option value="all">All</option>
            <option value="not_replied">Not Replied</option>
            <option value="replied">Replied</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="px-3 py-2 bg-tiktok-gray border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-tiktok-red"
          >
            <option value="newest">Newest Comments</option>
            <option value="oldest">Oldest Comments</option>
            <option value="recent_scrape">Recently Scraped</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between pb-2 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
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
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-tiktok-red focus:ring-tiktok-red"
            />
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `Select all (${filteredComments.length})`}
          </label>
        </div>

        <button
          onClick={() => setShowBulkDeleteConfirm(true)}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 border border-red-400/50 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-gray-400 disabled:border-gray-600 disabled:hover:bg-transparent"
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Remove
        </button>
      </div>

      {displayComments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {comments.length === 0
            ? "No comments scraped yet. Start scraping to see comments here."
            : "No comments match your search/filter criteria."}
        </div>
      ) : (
        <Virtuoso
          data={displayComments}
          useWindowScroll
          overscan={10}
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
