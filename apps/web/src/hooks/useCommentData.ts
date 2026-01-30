"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, ScrapedComment } from "@/utils/constants";

interface CommentDataState {
  commentLimit: number;
  postLimit: number;
  loading: boolean;
  error: string | null;
}

export function useCommentData() {
  const { userId } = useAuth();
  const [state, setState] = useState<CommentDataState>({
    commentLimit: 100,
    postLimit: 50,
    loading: true,
    error: null,
  });

  const comments = useQuery(
    api.comments.list,
    userId ? { clerkId: userId } : "skip"
  );
  const settings = useQuery(
    api.settings.get,
    userId ? { clerkId: userId } : "skip"
  );

  const removeCommentMutation = useMutation(api.comments.remove);
  const removeCommentsMutation = useMutation(api.comments.removeBatch);
  const updateCommentMutation = useMutation(api.comments.update);
  const updateSettingsMutation = useMutation(api.settings.update);

  useEffect(() => {
    if (settings) {
      setState((prev) => ({
        ...prev,
        commentLimit: settings.commentLimit ?? 100,
        postLimit: settings.postLimit ?? 50,
        loading: false,
      }));
    }
  }, [settings]);

  useEffect(() => {
    if (comments !== undefined) {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [comments]);

  const lastCommentsCountRef = useRef<number>(0);

  useEffect(() => {
    if (!bridge) return;

    const cleanups = [
      bridge.on(MessageType.SCRAPE_VIDEO_COMMENTS_COMPLETE, () => {
        lastCommentsCountRef.current = 0;
      }),

      bridge.on(MessageType.GET_BATCH_COMMENTS_COMPLETE, () => {
        lastCommentsCountRef.current = 0;
      }),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  const saveCommentLimit = useCallback(
    async (limit: number) => {
      if (!userId) return;

      setState((prev) => ({ ...prev, commentLimit: limit }));
      await updateSettingsMutation({
        clerkId: userId,
        settings: { commentLimit: limit },
      });

      if (bridge) {
        bridge.send(MessageType.SAVE_COMMENT_LIMIT, { limit });
      }
    },
    [userId, updateSettingsMutation]
  );

  const savePostLimit = useCallback(
    async (limit: number) => {
      if (!userId) return;

      setState((prev) => ({ ...prev, postLimit: limit }));
      await updateSettingsMutation({
        clerkId: userId,
        settings: { postLimit: limit },
      });

      if (bridge) {
        bridge.send(MessageType.SAVE_POST_LIMIT, { limit });
      }
    },
    [userId, updateSettingsMutation]
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      if (!userId) return;

      await removeCommentMutation({
        clerkId: userId,
        commentId,
      });

      if (bridge) {
        bridge.send(MessageType.REMOVE_SCRAPED_COMMENT, { commentId });
      }
    },
    [userId, removeCommentMutation]
  );

  const removeComments = useCallback(
    async (commentIds: string[]) => {
      if (!userId) return;

      await removeCommentsMutation({
        clerkId: userId,
        commentIds,
      });

      if (bridge) {
        bridge.send(MessageType.REMOVE_SCRAPED_COMMENTS, { commentIds });
      }
    },
    [userId, removeCommentsMutation]
  );

  const updateComment = useCallback(
    async (commentId: string, updates: Partial<ScrapedComment>) => {
      if (!userId) return;

      const convexUpdates: {
        replySent?: boolean;
        repliedAt?: number;
        replyError?: string;
        replyContent?: string;
      } = {};

      if (updates.replySent !== undefined)
        convexUpdates.replySent = updates.replySent;
      if (updates.repliedAt !== undefined)
        convexUpdates.repliedAt = new Date(updates.repliedAt).getTime();
      if (updates.replyError !== undefined)
        convexUpdates.replyError = updates.replyError;
      if (updates.replyContent !== undefined)
        convexUpdates.replyContent = updates.replyContent;

      await updateCommentMutation({
        clerkId: userId,
        commentId,
        updates: convexUpdates,
      });

      if (bridge) {
        bridge.send(MessageType.UPDATE_SCRAPED_COMMENT, { commentId, updates });
      }
    },
    [userId, updateCommentMutation]
  );

  return {
    comments: (comments ?? []) as ScrapedComment[],
    commentLimit: state.commentLimit,
    postLimit: state.postLimit,
    loading: state.loading || comments === undefined,
    error: state.error,
    removeComment,
    removeComments,
    updateComment,
    saveCommentLimit,
    savePostLimit,
  };
}
