"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { ScrapedUser } from "@/utils/constants";
import { UserCard } from "./UserCard";

type FilterStatus = "all" | "sent" | "not_sent" | "failed";
type SortOption = "newest" | "oldest" | "recent_scrape";

interface CommentTableProps {
  users: ScrapedUser[];
  selectedIds: Set<string>;
  commentLimit: number;
  onSelectUser: (userId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onRemoveUser: (userId: string) => void;
  onSendMessage: (user: ScrapedUser) => void;
  onReplyComment: (user: ScrapedUser) => void;
  onCommentLimitChange: (limit: number) => void;
  videoIdFilter?: string | null;
}

export function CommentTable({
  users,
  selectedIds,
  commentLimit,
  onSelectUser,
  onSelectAll,
  onRemoveUser,
  onSendMessage,
  onReplyComment,
  onCommentLimitChange,
  videoIdFilter,
}: CommentTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [commentLimitInput, setCommentLimitInput] = useState<string>(String(commentLimit));

  useEffect(() => {
    setCommentLimitInput(String(commentLimit));
  }, [commentLimit]);

  const handleCommentLimitBlur = useCallback(() => {
    const parsed = parseInt(commentLimitInput);
    const value = isNaN(parsed) || parsed < 1 ? 100 : parsed;
    setCommentLimitInput(String(value));
    onCommentLimitChange(value);
  }, [commentLimitInput, onCommentLimitChange]);

  const filteredUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      if (videoIdFilter && user.videoId !== videoIdFilter) {
        return false;
      }

      const matchesSearch =
        search === "" ||
        user.handle.toLowerCase().includes(search.toLowerCase()) ||
        user.comment.toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === "all" ||
        (filter === "sent" && user.messageSent) ||
        (filter === "not_sent" && !user.messageSent && !user.messageError) ||
        (filter === "failed" && user.messageError);

      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a, b) => {
      if (sort === "newest") {
        const aTime = a.commentTimestamp ? new Date(a.commentTimestamp).getTime() : 0;
        const bTime = b.commentTimestamp ? new Date(b.commentTimestamp).getTime() : 0;
        return bTime - aTime;
      }
      if (sort === "oldest") {
        const aTime = a.commentTimestamp ? new Date(a.commentTimestamp).getTime() : 0;
        const bTime = b.commentTimestamp ? new Date(b.commentTimestamp).getTime() : 0;
        return aTime - bTime;
      }
      // recent_scrape
      return new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime();
    });
  }, [users, search, filter, sort, videoIdFilter]);

  const allSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedIds.has(u.id));

  const stats = useMemo(() => {
    const sent = users.filter((u) => u.messageSent).length;
    const failed = users.filter((u) => u.messageError).length;
    const pending = users.length - sent - failed;
    return { total: users.length, sent, failed, pending };
  }, [users]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-4 text-sm text-gray-400">
          <span>Total: {stats.total}</span>
          <span className="text-green-400">Sent: {stats.sent}</span>
          <span className="text-yellow-400">Pending: {stats.pending}</span>
          <span className="text-red-400">Failed: {stats.failed}</span>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Limit:</label>
            <input
              type="number"
              value={commentLimitInput}
              onChange={(e) => setCommentLimitInput(e.target.value)}
              onBlur={handleCommentLimitBlur}
              min={1}
              className="w-20 px-2 py-1.5 bg-tiktok-gray border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-tiktok-red"
              title="Maximum comments to scrape per post"
            />
          </div>

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
            <option value="not_sent">Not Sent</option>
            <option value="sent">Sent</option>
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

      <div className="flex items-center gap-4 pb-2 border-b border-gray-700">
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-tiktok-red focus:ring-tiktok-red"
          />
          Select all ({filteredUsers.length})
        </label>

        {selectedIds.size > 0 && (
          <span className="text-sm text-tiktok-red">
            {selectedIds.size} selected
          </span>
        )}
      </div>

      {filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {users.length === 0
            ? "No comments scraped yet. Start scraping to see comments here."
            : "No comments match your search/filter criteria."}
        </div>
      ) : (
        <Virtuoso
          data={filteredUsers}
          useWindowScroll
          overscan={10}
          itemContent={(index, user) => (
            <div className={index > 0 ? "pt-3" : ""}>
              <UserCard
                user={user}
                selected={selectedIds.has(user.id)}
                onSelect={(selected) => onSelectUser(user.id, selected)}
                onRemove={() => onRemoveUser(user.id)}
                onSendMessage={() => onSendMessage(user)}
                onReplyComment={() => onReplyComment(user)}
              />
            </div>
          )}
        />
      )}
    </div>
  );
}
