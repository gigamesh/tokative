"use client";

import { useState, useEffect, useCallback } from "react";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, IgnoreListEntry } from "@/utils/constants";

export function useIgnoreList() {
  const [ignoreList, setIgnoreList] = useState<IgnoreListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIgnoreList = useCallback(async () => {
    if (!bridge) return;

    try {
      const response = await bridge.request<{ ignoreList: IgnoreListEntry[] }>(
        MessageType.GET_IGNORE_LIST
      );
      setIgnoreList(response.ignoreList || []);
    } catch (error) {
      console.error("Failed to fetch ignore list:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIgnoreList();
  }, [fetchIgnoreList]);

  const addToIgnoreList = useCallback(async (text: string) => {
    if (!bridge) return;

    const newEntry: IgnoreListEntry = {
      text,
      addedAt: new Date().toISOString(),
    };
    setIgnoreList((prev) => [...prev, newEntry]);
    bridge.send(MessageType.ADD_TO_IGNORE_LIST, { text });
  }, []);

  const removeFromIgnoreList = useCallback(async (text: string) => {
    if (!bridge) return;

    setIgnoreList((prev) => prev.filter((entry) => entry.text !== text));
    bridge.send(MessageType.REMOVE_FROM_IGNORE_LIST, { text });
  }, []);

  return {
    ignoreList,
    loading,
    addToIgnoreList,
    removeFromIgnoreList,
    refetch: fetchIgnoreList,
  };
}
