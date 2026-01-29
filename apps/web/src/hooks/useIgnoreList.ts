"use client";

import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tiktok-buddy/convex";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, IgnoreListEntry } from "@/utils/constants";

export function useIgnoreList() {
  const { userId } = useAuth();

  const ignoreListQuery = useQuery(
    api.ignoreList.list,
    userId ? { clerkId: userId } : "skip"
  );
  const addMutation = useMutation(api.ignoreList.add);
  const removeMutation = useMutation(api.ignoreList.remove);

  const ignoreList = (ignoreListQuery ?? []) as IgnoreListEntry[];
  const loading = ignoreListQuery === undefined;

  const addToIgnoreList = useCallback(
    async (text: string) => {
      if (!userId) return;

      await addMutation({
        clerkId: userId,
        text,
      });

      if (bridge) {
        bridge.send(MessageType.ADD_TO_IGNORE_LIST, { text });
      }
    },
    [userId, addMutation]
  );

  const removeFromIgnoreList = useCallback(
    async (text: string) => {
      if (!userId) return;

      await removeMutation({
        clerkId: userId,
        text,
      });

      if (bridge) {
        bridge.send(MessageType.REMOVE_FROM_IGNORE_LIST, { text });
      }
    },
    [userId, removeMutation]
  );

  const refetch = useCallback(() => {
    // No-op: Convex provides real-time reactivity
  }, []);

  return {
    ignoreList,
    loading,
    addToIgnoreList,
    removeFromIgnoreList,
    refetch,
  };
}
