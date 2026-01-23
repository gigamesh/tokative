"use client";

import { ScrapedComment } from "@/utils/constants";
import { useMemo, useState, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";
import { CommentCard } from "./CommentCard";
import { FetchCommentsButton } from "./FetchCommentsButton";

type FilterStatus = "all" | "replied" | "not_replied" | "failed";
type SortOption = "newest" | "oldest" | "recent_scrape";

interface CommentTableProps {
  comments: ScrapedComment[];
  selectedIds: Set<string>;
  onSelectComment: (commentId: string, selected: boolean) => void;
  onSelectFiltered: (commentIds: string[], selected: boolean) => void;
  onRemoveComment: (commentId: string) => void;
  onRemoveSelected: () => void;
  onFetchComments: (videoIds: string[]) => void;
  onReplyComment: (comment: ScrapedComment) => void;
  videoIdFilter?: string | null;
}

export function CommentTable({
  comments,
  selectedIds,
  onSelectComment,
  onSelectFiltered,
  onRemoveComment,
  onRemoveSelected,
  onFetchComments,
  onReplyComment,
  videoIdFilter,
}: CommentTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortOption>("newest");

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
        (filter === "not_replied" && !comment.replySent && !comment.replyError) ||
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

  const filteredSelectedCount = filteredComments.filter((c) =>
    selectedIds.has(c.id),
  ).length;
  const allFilteredSelected =
    filteredComments.length > 0 && filteredSelectedCount === filteredComments.length;
  const someFilteredSelected =
    filteredSelectedCount > 0 && filteredSelectedCount < filteredComments.length;

  const handleFetchComments = useCallback(() => {
    if (videoIdFilter) {
      onFetchComments([videoIdFilter]);
    } else {
      const selectedCommentIds = Array.from(selectedIds);
      const videoIds = Array.from(
        new Set(
          comments
            .filter((c) => selectedCommentIds.includes(c.id) && c.videoId)
            .map((c) => c.videoId!),
        ),
      );
      if (videoIds.length > 0) {
        onFetchComments(videoIds);
      }
    }
  }, [videoIdFilter, selectedIds, comments, onFetchComments]);

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
            className="px-3 py-2 bg-tiktok-gray border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red"
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

        <div className="flex items-center gap-3">
          <button
            onClick={onRemoveSelected}
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
          <FetchCommentsButton
            onClick={handleFetchComments}
            disabled={!videoIdFilter && selectedIds.size === 0}
          />
        </div>
      </div>

      {filteredComments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {comments.length === 0
            ? "No comments scraped yet. Start scraping to see comments here."
            : "No comments match your search/filter criteria."}
        </div>
      ) : (
        <Virtuoso
          data={filteredComments}
          useWindowScroll
          overscan={10}
          itemContent={(index, comment) => (
            <div className={index > 0 ? "pt-3" : ""}>
              <CommentCard
                comment={comment}
                selected={selectedIds.has(comment.id)}
                onSelect={(selected) => onSelectComment(comment.id, selected)}
                onRemove={() => onRemoveComment(comment.id)}
                onReplyComment={() => onReplyComment(comment)}
              />
            </div>
          )}
        />
      )}
    </div>
  );
}
