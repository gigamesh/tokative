"use client";

import { ScrapedUser } from "@/utils/constants";
import { useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { CommentCard } from "./CommentCard";

type FilterStatus = "all" | "replied" | "not_replied" | "failed";
type SortOption = "newest" | "oldest" | "recent_scrape";

interface CommentTableProps {
  users: ScrapedUser[];
  selectedIds: Set<string>;
  onSelectUser: (userId: string, selected: boolean) => void;
  onSelectFiltered: (userIds: string[], selected: boolean) => void;
  onRemoveUser: (userId: string) => void;
  onRemoveSelected: () => void;
  onFetchComments: (videoIds: string[]) => void;
  onReplyComment: (user: ScrapedUser) => void;
  videoIdFilter?: string | null;
}

export function CommentTable({
  users,
  selectedIds,
  onSelectUser,
  onSelectFiltered,
  onRemoveUser,
  onRemoveSelected,
  onFetchComments,
  onReplyComment,
  videoIdFilter,
}: CommentTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sort, setSort] = useState<SortOption>("newest");

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
        (filter === "replied" && user.replySent) ||
        (filter === "not_replied" && !user.replySent && !user.replyError) ||
        (filter === "failed" && user.replyError);

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
  }, [users, search, filter, sort, videoIdFilter]);

  const filteredSelectedCount = filteredUsers.filter((u) =>
    selectedIds.has(u.id),
  ).length;
  const allFilteredSelected =
    filteredUsers.length > 0 && filteredSelectedCount === filteredUsers.length;
  const someFilteredSelected =
    filteredSelectedCount > 0 && filteredSelectedCount < filteredUsers.length;

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
                const filteredIds = filteredUsers.map((u) => u.id);
                onSelectFiltered(filteredIds, e.target.checked);
              }}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-tiktok-red focus:ring-tiktok-red"
            />
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `Select all (${filteredUsers.length})`}
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRemoveSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 border border-gray-600 hover:text-red-400 hover:border-red-400/50 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:hover:border-gray-600"
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
          <button
            onClick={() => {
              if (videoIdFilter) {
                onFetchComments([videoIdFilter]);
              } else {
                const selectedUserIds = Array.from(selectedIds);
                const videoIds = Array.from(
                  new Set(
                    users
                      .filter(
                        (u) => selectedUserIds.includes(u.id) && u.videoId,
                      )
                      .map((u) => u.videoId!),
                  ),
                );
                if (videoIds.length > 0) {
                  onFetchComments(videoIds);
                }
              }
            }}
            disabled={!videoIdFilter && selectedIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 border border-gray-600 hover:text-tiktok-red hover:border-tiktok-red/50 hover:bg-tiktok-red/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:hover:border-gray-600"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Fetch Comments
          </button>
        </div>
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
              <CommentCard
                user={user}
                selected={selectedIds.has(user.id)}
                onSelect={(selected) => onSelectUser(user.id, selected)}
                onRemove={() => onRemoveUser(user.id)}
                onReplyComment={() => onReplyComment(user)}
              />
            </div>
          )}
        />
      )}
    </div>
  );
}
