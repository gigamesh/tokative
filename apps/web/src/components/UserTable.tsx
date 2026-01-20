"use client";

import { useState, useMemo } from "react";
import { ScrapedUser } from "@/utils/constants";
import { UserCard } from "./UserCard";

type FilterStatus = "all" | "sent" | "not_sent" | "failed";

interface UserTableProps {
  users: ScrapedUser[];
  selectedIds: Set<string>;
  onSelectUser: (userId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onRemoveUser: (userId: string) => void;
  onSendMessage: (user: ScrapedUser) => void;
}

export function UserTable({
  users,
  selectedIds,
  onSelectUser,
  onSelectAll,
  onRemoveUser,
  onSendMessage,
}: UserTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
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
  }, [users, search, filter]);

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

        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search users..."
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
            ? "No users scraped yet. Start scraping to see users here."
            : "No users match your search/filter criteria."}
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
          {filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              selected={selectedIds.has(user.id)}
              onSelect={(selected) => onSelectUser(user.id, selected)}
              onRemove={() => onRemoveUser(user.id)}
              onSendMessage={() => onSendMessage(user)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
