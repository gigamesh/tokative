"use client";

import { useState, useCallback, useMemo } from "react";
import { useAction } from "convex/react";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";

export function useTranslation(featureEnabled: boolean) {
  const { userId } = useAuth();
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());

  const targetLanguage = useMemo(
    () => (typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en"),
    [],
  );

  const translateCommentAction = useAction(api.translation.translateComment);

  const translateComment = useCallback(
    async (commentId: string) => {
      if (!userId || !featureEnabled) return;
      setTranslatingIds((prev) => new Set(prev).add(commentId));
      try {
        await translateCommentAction({
          clerkId: userId,
          commentId,
          targetLanguage,
        });
      } finally {
        setTranslatingIds((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      }
    },
    [userId, featureEnabled, targetLanguage, translateCommentAction],
  );

  return {
    translatingIds,
    targetLanguage,
    translateComment,
  };
}
