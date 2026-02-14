"use client";

import { useState, useCallback, useMemo } from "react";
import { useAction } from "convex/react";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";

export function useTranslation(featureEnabled: boolean) {
  const { userId } = useAuth();
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [isTranslatingReplies, setIsTranslatingReplies] = useState(false);

  const targetLanguage = useMemo(
    () => (typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en"),
    [],
  );

  const translateCommentAction = useAction(api.translation.translateComment);
  const translateRepliesAction = useAction(api.translation.translateReplies);

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

  const translateReplies = useCallback(
    async (translations: Array<{ text: string; targetLanguage: string }>) => {
      if (!userId || !featureEnabled) return [];
      setIsTranslatingReplies(true);
      try {
        return await translateRepliesAction({
          clerkId: userId,
          translations,
        });
      } finally {
        setIsTranslatingReplies(false);
      }
    },
    [userId, featureEnabled, translateRepliesAction],
  );

  return {
    translatingIds,
    targetLanguage,
    translateComment,
    translateReplies,
    isTranslatingReplies,
  };
}
