"use client";

interface StatsCardsProps {
  totals: {
    totalComments: number;
    totalReplies: number;
    totalVideos: number;
    uniqueUsers: number;
  };
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-elevated border border-border rounded-lg p-5">
      <p className="text-sm text-foreground-muted">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function StatsCards({ totals }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card label="Total Comments" value={totals.totalComments} />
      <Card label="Total Replies" value={totals.totalReplies} />
      <Card label="Total Videos" value={totals.totalVideos} />
      <Card label="Unique Users" value={totals.uniqueUsers} />
    </div>
  );
}
