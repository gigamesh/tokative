"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";

interface UserStat {
  email: string;
  commentCount: number;
  replyCount: number;
  videoCount: number;
  createdAt: number;
}

interface UserTableProps {
  users: UserStat[];
}

type SortKey = "email" | "commentCount" | "replyCount" | "videoCount" | "createdAt";
type SortDir = "asc" | "desc";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function SortIcon({ sortKey, currentKey, dir }: { sortKey: SortKey; currentKey: SortKey; dir: SortDir }) {
  if (sortKey !== currentKey) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
  return dir === "asc"
    ? <ArrowUp className="w-3 h-3" />
    : <ArrowDown className="w-3 h-3" />;
}

export function UserTable({ users }: UserTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("commentCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...users].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const cmp = typeof aVal === "string"
      ? aVal.localeCompare(bVal as string)
      : (aVal as number) - (bVal as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const columns: { key: SortKey; label: string }[] = [
    { key: "email", label: "Email" },
    { key: "commentCount", label: "Comments" },
    { key: "replyCount", label: "Replies" },
    { key: "videoCount", label: "Videos" },
    { key: "createdAt", label: "Joined" },
  ];

  return (
    <div className="bg-surface-elevated border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-foreground-muted font-medium cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon sortKey={col.key} currentKey={sortKey} dir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((user) => (
              <tr key={user.email} className="border-b border-border last:border-0 hover:bg-surface-secondary/50 transition-colors">
                <td className="px-4 py-3 text-foreground">{user.email}</td>
                <td className="px-4 py-3 text-foreground">{user.commentCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-foreground">{user.replyCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-foreground">{user.videoCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-foreground-muted">{formatTimeAgo(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
