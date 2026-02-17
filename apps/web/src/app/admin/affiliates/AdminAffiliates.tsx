"use client";

import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdminAffiliates() {
  const { userId, isLoaded } = useAuth();
  const affiliates = useQuery(
    api.admin.getAffiliates,
    isLoaded && userId ? { clerkId: userId } : "skip"
  );
  const createAffiliate = useMutation(api.admin.createAffiliate);
  const toggleWhitelist = useMutation(api.admin.toggleAffiliateWhitelist);

  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoaded || affiliates === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !email.trim()) return;

    setCreating(true);
    setError(null);
    try {
      await createAffiliate({ clerkId: userId, affiliateEmail: email.trim() });
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create affiliate");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(affiliateId: string, currentValue: boolean) {
    if (!userId) return;
    await toggleWhitelist({
      clerkId: userId,
      affiliateId: affiliateId as any,
      isWhitelisted: !currentValue,
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">
        Affiliate Management
      </h1>

      <form
        onSubmit={handleCreate}
        className="flex items-end gap-3 p-4 rounded-lg bg-surface-elevated border border-border"
      >
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground-muted mb-1">
            Add Affiliate by Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent-cyan-solid"
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={creating || !email.trim()}
        >
          <Plus className="w-4 h-4" />
          {creating ? "Adding..." : "Add"}
        </Button>
      </form>

      {error && (
        <p className="text-red-400 text-sm px-1">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-elevated text-foreground-muted">
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Code</th>
              <th className="text-left px-4 py-3 font-medium">Connect</th>
              <th className="text-right px-4 py-3 font-medium">Earned</th>
              <th className="text-center px-4 py-3 font-medium">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {affiliates.map((aff) => (
              <tr key={aff._id} className="text-foreground">
                <td className="px-4 py-3">{aff.email}</td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-surface px-1.5 py-0.5 rounded">
                    {aff.affiliateCode}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      aff.connectStatus === "active"
                        ? "bg-green-500/10 text-green-400"
                        : aff.connectStatus === "restricted"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {aff.connectStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {formatCents(aff.totalEarnedCents)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggle(aff._id, aff.isWhitelisted)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${
                      aff.isWhitelisted ? "bg-green-500" : "bg-surface-secondary"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        aff.isWhitelisted
                          ? "translate-x-5"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
            {affiliates.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-foreground-muted"
                >
                  No affiliates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
