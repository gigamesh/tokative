"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, usePaginatedQuery, useConvex } from "convex/react";
import { useAuth } from "@/providers/ConvexProvider";
import { api } from "@tokative/convex";
import { bridge } from "@/utils/extension-bridge";
import { MessageType, ScrapedComment } from "@/utils/constants";
import { useDebounce } from "./useDebounce";

interface CommentDataState {
  postLimit: number;
  hideOwnReplies: boolean;
  deleteMissingComments: boolean | null;
  loading: boolean;
  error: string | null;
}

const PAGE_SIZE = 50;
const DEBOUNCE_MS = 300;

interface UseCommentDataOptions {
  videoIdFilter?: string | null;
  sortOrder?: "asc" | "desc";
}

export function useCommentData(options: UseCommentDataOptions = {}) {
  const { videoIdFilter, sortOrder = "desc" } = options;
  const { userId } = useAuth();
  const convex = useConvex();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, DEBOUNCE_MS);
  const [state, setState] = useState<CommentDataState>({
    postLimit: 50,
    hideOwnReplies: false,
    deleteMissingComments: null,
    loading: true,
    error: null,
  });

  const [optimisticComments, setOptimisticComments] = useState<ScrapedComment[]>([]);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  const {
    results: paginatedComments,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(
    api.comments.listPaginated,
    userId
      ? {
          clerkId: userId,
          videoId: videoIdFilter ?? undefined,
          sortOrder,
          search: debouncedSearch,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
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
        postLimit: settings.postLimit ?? 50,
        hideOwnReplies: settings.hideOwnReplies ?? false,
        deleteMissingComments: settings.deleteMissingComments ?? null,
        loading: false,
      }));
    }
  }, [settings]);

  useEffect(() => {
    if (paginatedComments !== undefined && !hasLoadedInitial) {
      setHasLoadedInitial(true);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [paginatedComments, hasLoadedInitial]);

  const lastCommentsCountRef = useRef<number>(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    loadingRef.current = paginationStatus === "LoadingMore";
  }, [paginationStatus]);

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

  const addOptimisticComment = useCallback((comment: ScrapedComment) => {
    setOptimisticComments((prev) => [comment, ...prev]);
  }, []);

  const comments = useMemo(() => {
    const convexComments = (paginatedComments ?? []) as unknown as ScrapedComment[];
    const convexIds = new Set(convexComments.map((c) => c.id));
    const newOptimistic = optimisticComments.filter((c) => !convexIds.has(c.id));
    return [...newOptimistic, ...convexComments];
  }, [paginatedComments, optimisticComments]);

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

  const saveHideOwnReplies = useCallback(
    async (hide: boolean) => {
      if (!userId) return;

      setState((prev) => ({ ...prev, hideOwnReplies: hide }));
      await updateSettingsMutation({
        clerkId: userId,
        settings: { hideOwnReplies: hide },
      });
    },
    [userId, updateSettingsMutation]
  );

  const saveDeleteMissingComments = useCallback(
    async (value: boolean) => {
      if (!userId) return;

      setState((prev) => ({ ...prev, deleteMissingComments: value }));
      await updateSettingsMutation({
        clerkId: userId,
        settings: { deleteMissingComments: value },
      });
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
        repliedTo?: boolean;
        repliedAt?: number;
        replyError?: string;
        replyContent?: string;
      } = {};

      if (updates.repliedTo !== undefined)
        convexUpdates.repliedTo = updates.repliedTo;
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

  const handleLoadMore = useCallback(() => {
    if (loadingRef.current) return;
    if (paginationStatus === "CanLoadMore") {
      loadingRef.current = true;
      loadMore(PAGE_SIZE);
    }
  }, [paginationStatus, loadMore]);

  const findMatchingComments = useCallback(
    async (commentText: string, excludeCommentId: string): Promise<string[]> => {
      if (!userId) return [];
      return convex.query(api.comments.findMatchingByText, {
        clerkId: userId,
        commentText,
        excludeCommentId,
      });
    },
    [userId, convex]
  );

  useEffect(() => {
    if (
      paginatedComments &&
      paginatedComments.length < PAGE_SIZE &&
      paginationStatus === "CanLoadMore" &&
      !loadingRef.current
    ) {
      loadingRef.current = true;
      loadMore(PAGE_SIZE);
    }
  }, [paginatedComments, paginationStatus, loadMore]);

  const isInitialLoading = state.loading ||
    paginationStatus === "LoadingFirstPage" ||
    (!hasLoadedInitial && paginatedComments === undefined);


  return {
    comments,
    postLimit: state.postLimit,
    hideOwnReplies: state.hideOwnReplies,
    deleteMissingComments: state.deleteMissingComments,
    loading: isInitialLoading,
    error: state.error,
    removeComment,
    removeComments,
    updateComment,
    savePostLimit,
    saveHideOwnReplies,
    saveDeleteMissingComments,
    addOptimisticComment,
    loadMore: handleLoadMore,
    hasMore: paginationStatus === "CanLoadMore",
    isLoadingMore: paginationStatus === "LoadingMore",
    findMatchingComments,
    search,
    setSearch,
  };
}
