"use client";

import { useAuth } from "@/providers/ConvexProvider";
import { Spinner } from "@/components/Spinner";
import { StatsCards } from "./StatsCards";
import { UserTable } from "./UserTable";
import { api } from "@tokative/convex";
import { useQuery } from "convex/react";

export function AdminDashboard() {
  const { userId, isLoaded } = useAuth();
  const stats = useQuery(
    api.admin.getStats,
    isLoaded && userId ? { clerkId: userId } : "skip",
  );

  if (!isLoaded || stats === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
      <StatsCards totals={stats.totals} />
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Users</h2>
        <UserTable users={stats.users} />
      </div>
    </div>
  );
}
