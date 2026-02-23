"use client";

import { AddToIgnoreListModal } from "@/components/AddToIgnoreListModal";
import { Button } from "@/components/Button";

import { CommentTable, SortOption } from "@/components/CommentTable";
import { CommenterTable } from "@/components/CommenterTable";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { LimitReachedModal } from "@/components/LimitReachedModal";
import { PostsGrid } from "@/components/PostsGrid";
import { QueuePanel } from "@/components/QueuePanel";
import { ReplyComposer } from "@/components/ReplyComposer";
import { ScrapeReportModal } from "@/components/ScrapeReportModal";
import { SelectedPostContext } from "@/components/SelectedPostContext";
import { SettingsModal } from "@/components/SettingsModal";
import { Spinner } from "@/components/Spinner";
import { TabContentContainer } from "@/components/TabContentContainer";
import { TabNavigation } from "@/components/TabNavigation";
import { Toast } from "@/components/Toast";
import { useCommentCounts } from "@/hooks/useCommentCounts";
import { useCommentData } from "@/hooks/useCommentData";
import { useCommenterData } from "@/hooks/useCommenterData";
import { useIgnoreList } from "@/hooks/useIgnoreList";
import { useMessaging } from "@/hooks/useMessaging";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useTokativeEndpoint } from "@/hooks/useTokativeEndpoint";
import { useTranslation } from "@/hooks/useTranslation";
import { useVideoData } from "@/hooks/useVideoData";
import { useAuth } from "@/providers/ConvexProvider";
import { ScrapedComment, TERMINAL_REPLY_STATUSES } from "@/utils/constants";
import { api, BILLING_ENABLED, PLAN_LIMITS } from "@tokative/convex";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Settings, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

interface DeleteModalState {
  isOpen: boolean;
  commentId: string;
  commentText: string;
  matchingIds: string[];
}

interface IgnoreListModalState {
  isOpen: boolean;
  commentText: string;
}

export function DashboardContent() {
  const { userId } = useAuth();
  const accessStatus = useQuery(
    api.users.getAccessStatus,
    userId ? { clerkId: userId } : "skip",
  );
  const translationEnabled = accessStatus?.features?.translation ?? false;

  const {
    activeTab,
    selectedPostId,
    setTab,
    setSelectedPost,
    clearPostFilter,
  } = useTokativeEndpoint();

  const [commentSort, setCommentSort] = useState<SortOption>("newest");

  const handleSortChange = useCallback((newSort: SortOption) => {
    window.scrollTo({ top: 0 });
    setCommentSort(newSort);
  }, []);

  const {
    comments: allComments,
    postLimit,
    hideOwnReplies,
    hideMissingComments,
    accountHandle,
    loading,
    error,
    removeComments,
    updateComment,
    savePostLimit,
    saveHideOwnReplies,
    saveHideMissingComments,
    saveAccountHandle,
    addOptimisticComment,
    loadMore,
    hasMore,
    isLoadingMore,
    findMatchingComments,
    fetchRepliesForThread,
    search: commentSearch,
    setSearch: setCommentSearch,
  } = useCommentData({
    videoIdFilter: selectedPostId,
    sortOrder: commentSort === "newest" ? "desc" : "asc",
  });

  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(
    new Set(),
  );

  const comments = useMemo(() => {
    let filtered = allComments;
    if (hideOwnReplies) {
      filtered = filtered.filter((c) => {
        if (c.source === "app") return false;
        if (accountHandle && c.isReply && c.handle === accountHandle) return false;
        return true;
      });
    }
    if (hideMissingComments) {
      filtered = filtered.filter(
        (c) => c.replyErrorCode !== "comment_not_found",
      );
    }
    if (optimisticDeletedIds.size > 0) {
      filtered = filtered.filter((c) => !optimisticDeletedIds.has(c.id));
    }
    return filtered;
  }, [allComments, hideOwnReplies, accountHandle, hideMissingComments, optimisticDeletedIds]);

  const handleReplyComplete = useCallback(
    (commentId: string) => {
      const updates: Partial<ScrapedComment> = {
        repliedTo: true,
        repliedAt: new Date().toISOString(),
      };
      updateComment(commentId, updates);
    },
    [updateComment],
  );

  const {
    isReplying,
    bulkReplyProgress,
    replyStatusMessage,
    startBulkReply,
    stopBulkReply,
    updateBulkReplyQueue,
    clearBulkReplyProgress,
  } = useMessaging({
    onReplyComplete: handleReplyComplete,
    onPostedReply: addOptimisticComment,
  });

  const {
    videos,
    loading: videosLoading,
    getCommentsProgress,
    getCommentsForVideos,
    addToBatch,
    removeFromBatch,
    removeVideos: removeVideosList,
    batchProgress,
    isScraping,
    isCancelling,
    cancelScraping,
    scrapeReport,
    closeScrapeReport,
  } = useVideoData();

  const { ignoreList, addToIgnoreList, removeFromIgnoreList } = useIgnoreList();

  const {
    translatingIds,
    targetLanguage,
    translateComment: handleTranslateComment,
    translateReplies,
    isTranslatingReplies,
  } = useTranslation(translationEnabled);

  const queuedCommentsFromDb = useQuery(
    api.comments.getQueue,
    userId ? { clerkId: userId } : "skip",
  );
  const enqueueMutation = useMutation(api.comments.enqueue);
  const dequeueMutation = useMutation(api.comments.dequeue);
  const clearQueueMutation = useMutation(api.comments.clearQueue);

  const [optimisticQueueItems, setOptimisticQueueItems] = useState<ScrapedComment[]>([]);

  useEffect(() => {
    if (!queuedCommentsFromDb || optimisticQueueItems.length === 0) return;
    const dbIds = new Set(queuedCommentsFromDb.map((c) => c.id));
    const remaining = optimisticQueueItems.filter((c) => !dbIds.has(c.id));
    if (remaining.length < optimisticQueueItems.length) {
      setOptimisticQueueItems(remaining);
    }
  }, [queuedCommentsFromDb, optimisticQueueItems]);

  const queuedComments = useMemo(() => {
    const dbComments = (queuedCommentsFromDb ?? []) as unknown as ScrapedComment[];
    if (optimisticQueueItems.length === 0) return dbComments;
    const dbIds = new Set(dbComments.map((c) => c.id));
    const newItems = optimisticQueueItems.filter((c) => !dbIds.has(c.id));
    return [...dbComments, ...newItems];
  }, [queuedCommentsFromDb, optimisticQueueItems]);

  const { commentCountsByVideo, totalCount: totalCommentCount } =
    useCommentCounts();

  const {
    commenters,
    loading: commentersLoading,
    totalCommenterCount,
    hasMore: hasMoreCommenters,
    loadMore: loadMoreCommenters,
    isLoadingMore: isLoadingMoreCommenters,
    search: commenterSearch,
    setSearch: setCommenterSearch,
  } = useCommenterData();

  const [selectedCommentIds, setSelectedCommentIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    new Set(),
  );
  const [searchingMatchesCommentId, setSearchingMatchesCommentId] = useState<
    string | null
  >(null);
  const [postLimitInput, setPostLimitInput] = useState(String(postLimit));

  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    commentId: "",
    commentText: "",
    matchingIds: [],
  });

  const [ignoreListModal, setIgnoreListModal] = useState<IgnoreListModalState>({
    isOpen: false,
    commentText: "",
  });

  const searchParams = useSearchParams();
  const router = useRouter();

  const [toast, setToast] = useState<{ isVisible: boolean; message: string; variant?: "success" | "error"; duration?: number }>({ isVisible: false, message: "" });
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [translateRepliesEnabled, setTranslateRepliesEnabled] = useState(false);

  const [replyReport, setReplyReport] = useState<{
    completed: number;
    failed: number;
    commentNotFound: number;
    mentionFailed: number;
    detectionFailed: number;
  } | null>(null);
  const [replyLimitModal, setReplyLimitModal] = useState<{
    completed: number;
    failed: number;
    commentNotFound: number;
    mentionFailed: number;
    detectionFailed: number;
  } | null>(null);

  const showToast = useCallback((message: string, variant?: "success" | "error", duration?: number) => {
    setToast({ isVisible: true, message, variant, duration });
  }, []);

  const hideToast = useCallback(() => {
    setToast({ isVisible: false, message: "" });
  }, []);

  useEffect(() => {
    if (optimisticDeletedIds.size === 0) return;
    const allIds = new Set(allComments.map((c) => c.id));
    const stillPresent = new Set(
      [...optimisticDeletedIds].filter((id) => allIds.has(id)),
    );
    if (stillPresent.size < optimisticDeletedIds.size) {
      setOptimisticDeletedIds(stillPresent);
    }
  }, [allComments, optimisticDeletedIds]);

  useScrollRestore("dashboard-scroll", !loading && !videosLoading);

  useEffect(() => {
    setPostLimitInput(String(postLimit));
  }, [postLimit]);

  useEffect(() => {
    if (error && error !== dismissedError) {
      setDismissedError(null);
    }
  }, [error, dismissedError]);

  useEffect(() => {
    if (BILLING_ENABLED && searchParams.get("checkout") === "success") {
      showToast("Subscription activated! Your plan is now active.");
      router.replace("/dashboard", { scroll: false });
    }
  }, [searchParams, showToast, router]);

  const currentPlan = accessStatus?.subscription?.plan ?? "free";
  const replyLimit =
    accessStatus?.subscription?.replyLimit ?? PLAN_LIMITS.free.monthlyReplies;
  const repliesUsed = accessStatus?.subscription?.repliesUsed ?? 0;
  const replyBudget = Math.max(0, replyLimit - repliesUsed);
  const replyLimitReached = replyBudget === 0;
  const commentLimitReached =
    (accessStatus?.subscription?.monthlyUsed ?? 0) >=
    (accessStatus?.subscription?.monthlyLimit ?? Infinity);

  useEffect(() => {
    if (bulkReplyProgress?.status === "complete") {
      if (bulkReplyProgress.abortReason === "USER_NOT_LOGGED_IN") {
        showToast(
          "You must be logged into TikTok to reply to comments. Please log in and try again.",
          "error",
        );
        return;
      }
      const stats = {
        completed: bulkReplyProgress.completed,
        failed: bulkReplyProgress.failed,
        commentNotFound: bulkReplyProgress.commentNotFound,
        mentionFailed: bulkReplyProgress.mentionFailed,
        detectionFailed: bulkReplyProgress.detectionFailed,
      };
      if (replyLimitReached) {
        setReplyLimitModal(stats);
      } else {
        setReplyReport(stats);
      }
    }
  }, [bulkReplyProgress, replyLimitReached, showToast]);

  const handlePostLimitBlur = useCallback(() => {
    const parsed = parseInt(postLimitInput);
    const value = isNaN(parsed) || parsed < 1 ? 50 : parsed;
    setPostLimitInput(String(value));
    savePostLimit(value);
  }, [postLimitInput, savePostLimit]);

  const selectedVideo = useMemo(() => {
    if (!selectedPostId) return null;
    return videos.find((v) => v.videoId === selectedPostId) ?? null;
  }, [selectedPostId, videos]);

  const filteredCommentCount = useMemo(() => {
    if (!selectedPostId) return 0;
    return commentCountsByVideo.get(selectedPostId) ?? 0;
  }, [selectedPostId, commentCountsByVideo]);

  const videoThumbnailMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const video of videos) {
      if (video.thumbnailUrl) {
        map.set(video.videoId, video.thumbnailUrl);
      }
    }
    return map;
  }, [videos]);

  const filteredCommenters = useMemo(() => {
    if (!hideOwnReplies || !accountHandle) return commenters;
    return commenters
      .map((c) => ({
        ...c,
        comments: c.comments.filter((comment) => {
          if (comment.source === "app") return false;
          if (comment.isReply && comment.handle === accountHandle) return false;
          return true;
        }),
      }))
      .filter((c) => c.comments.length > 0);
  }, [commenters, hideOwnReplies, accountHandle]);

  const allCommentsFromCommenters = useMemo(() => {
    const all: ScrapedComment[] = [];
    for (const commenter of filteredCommenters) {
      all.push(...commenter.comments);
    }
    return all;
  }, [filteredCommenters]);

  const selectedCommentsForDisplay = useMemo(() => {
    const idsArray = Array.from(selectedCommentIds);
    const selected: ScrapedComment[] = [];
    const commentsToSearch =
      activeTab === "commenters" ? allCommentsFromCommenters : comments;
    for (let i = idsArray.length - 1; i >= 0; i--) {
      const comment = commentsToSearch.find((c) => c.id === idsArray[i]);
      if (comment) selected.push(comment);
    }
    return selected;
  }, [comments, allCommentsFromCommenters, selectedCommentIds, activeTab]);

  const replyingCommentId = useMemo(() => {
    if (!bulkReplyProgress?.commentStatuses) return null;
    for (const [id, status] of Object.entries(bulkReplyProgress.commentStatuses)) {
      if (status === "replying") return id;
    }
    return null;
  }, [bulkReplyProgress?.commentStatuses]);

  useEffect(() => {
    if (!isReplying || queuedComments.length === 0) return;
    updateBulkReplyQueue(
      queuedComments.map((c) => ({
        ...c,
        messageToSend: c.queuedReplyText,
      })),
    );
  }, [isReplying, queuedComments, updateBulkReplyQueue]);

  const getCommentIdsByVideoIds = useCallback(
    (videoIds: string[]) =>
      comments
        .filter((c) => c.videoId && videoIds.includes(c.videoId))
        .map((c) => c.id),
    [comments],
  );

  const handleSelectComment = useCallback(
    (commentId: string, selected: boolean) => {
      setSelectedCommentIds((prev) => {
        const next = new Set(prev);
        if (selected) {
          next.add(commentId);
        } else {
          next.delete(commentId);
        }
        return next;
      });
    },
    [],
  );

  const handleSelectRange = useCallback(
    (commentIds: string[], selected: boolean) => {
      setSelectedCommentIds((prev) => {
        const next = new Set(prev);
        if (selected) {
          commentIds.forEach((id) => next.add(id));
        } else {
          commentIds.forEach((id) => next.delete(id));
        }
        return next;
      });
    },
    [],
  );

  const handleSelectFiltered = useCallback(
    (commentIds: string[], selected: boolean) => {
      setSelectedCommentIds((prev) => {
        const next = new Set(prev);
        if (selected) {
          commentIds.forEach((id) => next.add(id));
        } else {
          commentIds.forEach((id) => next.delete(id));
        }
        return next;
      });
    },
    [],
  );

  const handleRemoveSelected = useCallback(async () => {
    if (selectedCommentIds.size === 0) return;
    const idsToDelete = Array.from(selectedCommentIds);
    const count = idsToDelete.length;

    setIsDeletingSelected(true);
    setOptimisticDeletedIds((prev) => new Set([...prev, ...idsToDelete]));
    setSelectedCommentIds(new Set());
    window.scrollTo({ top: 0 });

    try {
      await removeComments(idsToDelete);
      showToast(`Deleted ${count} comment${count > 1 ? "s" : ""}`);
    } finally {
      setIsDeletingSelected(false);
    }
  }, [selectedCommentIds, removeComments, showToast]);

  const handleRemoveComment = useCallback(
    async (commentId: string) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;

      setSearchingMatchesCommentId(commentId);

      try {
        const matchingIds = await findMatchingComments(
          comment.comment,
          commentId,
        );

        if (matchingIds.length > 0) {
          setDeleteModal({
            isOpen: true,
            commentId,
            commentText: comment.comment,
            matchingIds,
          });
        } else {
          removeComments([commentId]);
          setSelectedCommentIds((prev) => {
            const next = new Set(prev);
            next.delete(commentId);
            return next;
          });
          showToast("Deleted 1 comment");
        }
      } finally {
        setSearchingMatchesCommentId(null);
      }
    },
    [comments, findMatchingComments, removeComments, showToast],
  );

  const handleDeleteOne = useCallback(() => {
    removeComments([deleteModal.commentId]);
    setSelectedCommentIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteModal.commentId);
      return next;
    });
    setDeleteModal({
      isOpen: false,
      commentId: "",
      commentText: "",
      matchingIds: [],
    });
    showToast("Deleted 1 comment");
  }, [deleteModal.commentId, removeComments, showToast]);

  const handleDeleteAll = useCallback(() => {
    const allIds = [deleteModal.commentId, ...deleteModal.matchingIds];
    const count = allIds.length;
    removeComments(allIds);
    setSelectedCommentIds((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.delete(id));
      return next;
    });
    setDeleteModal({
      isOpen: false,
      commentId: "",
      commentText: "",
      matchingIds: [],
    });
    setIgnoreListModal({ isOpen: true, commentText: deleteModal.commentText });
    showToast(`Deleted ${count} comments`);
  }, [deleteModal, removeComments, showToast]);

  const handleAddToIgnoreList = useCallback(() => {
    addToIgnoreList(ignoreListModal.commentText);
    setIgnoreListModal({ isOpen: false, commentText: "" });
  }, [ignoreListModal.commentText, addToIgnoreList]);

  const handleSkipIgnoreList = useCallback(() => {
    setIgnoreListModal({ isOpen: false, commentText: "" });
  }, []);

  const handleReplyComment = useCallback((comment: ScrapedComment) => {
    setSelectedCommentIds((prev) => {
      if (prev.has(comment.id)) return prev;
      const next = new Set(prev);
      next.add(comment.id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedCommentIds(new Set());
    clearBulkReplyProgress();
  }, [clearBulkReplyProgress]);

  const handleAddToQueue = useCallback(
    async (messages: string[]) => {
      if (!userId || selectedCommentIds.size === 0) return;

      const commentsToSearch =
        activeTab === "commenters" ? allCommentsFromCommenters : comments;
      const selected = Array.from(selectedCommentIds)
        .map((id) => commentsToSearch.find((c) => c.id === id))
        .filter((c): c is ScrapedComment => c != null);

      let replyTexts: string[] = selected.map(
        (_, i) => messages[i % messages.length],
      );

      if (translateRepliesEnabled && translationEnabled && targetLanguage) {
        try {
          const pairs: Array<{
            text: string;
            targetLanguage: string;
          }> = [];
          const pairIndices: number[] = [];
          for (let ci = 0; ci < selected.length; ci++) {
            const lang = selected[ci].detectedLanguage;
            if (!lang || lang === "other" || lang === targetLanguage) continue;
            pairs.push({ text: replyTexts[ci], targetLanguage: lang });
            pairIndices.push(ci);
          }

          if (pairs.length > 0) {
            const deduped = new Map<string, number>();
            const dedupedList: Array<{ text: string; targetLanguage: string }> = [];
            const pairToDedupIdx: number[] = [];
            for (const p of pairs) {
              const key = `${p.targetLanguage}:${p.text}`;
              if (!deduped.has(key)) {
                deduped.set(key, dedupedList.length);
                dedupedList.push(p);
              }
              pairToDedupIdx.push(deduped.get(key)!);
            }

            const results = await translateReplies(dedupedList);
            if (results && results.length > 0) {
              const translatedTexts = [...replyTexts];
              for (let pi = 0; pi < pairIndices.length; pi++) {
                const idx = pairToDedupIdx[pi];
                if (results[idx]) {
                  translatedTexts[pairIndices[pi]] = results[idx].translatedText;
                }
              }
              replyTexts = translatedTexts;
            }
          }
        } catch {
          showToast("Translation failed — queuing with original messages");
        }
      }

      const items = selected.map((c, i) => ({
        commentId: c.id,
        replyText: replyTexts[i],
      }));

      const optimistic = selected
        .filter((c) => !c.repliedTo && !c.replyErrorCode)
        .map((c, i) => ({
          ...c,
          queuedReplyText: replyTexts[i],
          queuedAt: new Date().toISOString(),
        }));
      setOptimisticQueueItems((prev) => [...prev, ...optimistic]);
      setSelectedCommentIds(new Set());
      showToast(`Added ${items.length} comment${items.length > 1 ? "s" : ""} to queue`);

      enqueueMutation({ clerkId: userId, items });
    },
    [
      userId,
      selectedCommentIds,
      activeTab,
      comments,
      allCommentsFromCommenters,
      translateRepliesEnabled,
      translationEnabled,
      targetLanguage,
      translateReplies,
      enqueueMutation,
      showToast,
    ],
  );

  const handleDequeue = useCallback(
    async (commentIds: string[]) => {
      if (!userId) return;
      await dequeueMutation({ clerkId: userId, commentIds });
    },
    [userId, dequeueMutation],
  );

  const handleClearQueue = useCallback(async () => {
    if (!userId) return;
    await clearQueueMutation({ clerkId: userId });
  }, [userId, clearQueueMutation]);

  const handleStartQueueReply = useCallback(() => {
    if (!queuedComments || queuedComments.length === 0) return;
    if (replyLimitReached) {
      showToast("Monthly reply limit reached. Upgrade for more replies.");
      return;
    }
    const capped = queuedComments.slice(0, replyBudget).map((c) => ({
      ...c,
      messageToSend: c.queuedReplyText,
    }));
    const messages = [...new Set(capped.map((c) => c.queuedReplyText ?? ""))].filter(Boolean);
    startBulkReply(capped, messages, new Set(capped.map((c) => c.id)));
  }, [queuedComments, replyBudget, replyLimitReached, startBulkReply, showToast]);

  const handleViewPostComments = useCallback(
    (videoId: string) => {
      setSelectedPost(videoId);
    },
    [setSelectedPost],
  );

  const [pendingRemovalVideoIds, setPendingRemovalVideoIds] = useState<Set<string>>(new Set());
  const isRemovingVideos = pendingRemovalVideoIds.size > 0;

  useEffect(() => {
    if (pendingRemovalVideoIds.size === 0) return;
    const currentVideoIds = new Set(videos.map((v) => v.videoId));
    const stillPending = new Set(
      [...pendingRemovalVideoIds].filter((id) => currentVideoIds.has(id)),
    );
    if (stillPending.size < pendingRemovalVideoIds.size) {
      setPendingRemovalVideoIds(stillPending);
    }
  }, [videos, pendingRemovalVideoIds]);

  const handleRemoveVideosWithComments = useCallback(
    async (videoIds: string[]) => {
      const commentIds = getCommentIdsByVideoIds(videoIds);
      setPendingRemovalVideoIds(new Set(videoIds));
      setSelectedCommentIds((prev) => {
        const next = new Set(prev);
        commentIds.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedVideoIds((prev) => {
        const next = new Set(prev);
        videoIds.forEach((id) => next.delete(id));
        return next;
      });
      await removeVideosList(videoIds);
    },
    [getCommentIdsByVideoIds, removeVideosList],
  );

  const handleCancelScraping = useCallback(() => {
    cancelScraping();
  }, [cancelScraping]);

  const handlePostSelectionChange = useCallback(
    (videoIds: string[], selected: boolean) => {
      if (!isScraping || isCancelling) return;
      if (selected) {
        addToBatch(videoIds);
      } else {
        removeFromBatch(videoIds);
      }
    },
    [isScraping, isCancelling, addToBatch, removeFromBatch],
  );

  return (
    <div className="min-h-content bg-surface">
      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && error !== dismissedError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-start justify-between gap-3 w-fit ml-auto">
            <span>{error}</span>
            <button
              onClick={() => setDismissedError(error)}
              className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
              aria-label="Dismiss error"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {BILLING_ENABLED &&
          accessStatus?.subscription &&
          (() => {
            const { monthlyUsed, monthlyLimit, plan } =
              accessStatus.subscription;
            const pct = Math.round((monthlyUsed / monthlyLimit) * 100);
            if (monthlyUsed >= monthlyLimit) {
              return (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3 w-fit ml-auto">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <span className="text-red-400 font-medium">
                      Monthly comment limit reached
                    </span>
                    <span className="text-red-400/80 ml-2">
                      ({monthlyUsed.toLocaleString()}/
                      {monthlyLimit.toLocaleString()})
                    </span>
                  </div>
                  <Link
                    href="/pricing"
                    className="text-sm text-red-400 hover:text-red-300 underline flex-shrink-0"
                  >
                    Upgrade
                  </Link>
                </div>
              );
            }
            if (pct >= 80) {
              return (
                <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center gap-3 w-fit ml-auto">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div>
                    <span className="text-yellow-400 font-medium">
                      {pct}% of monthly comment limit used
                    </span>
                    <span className="text-yellow-400/80 ml-2">
                      ({monthlyUsed.toLocaleString()}/
                      {monthlyLimit.toLocaleString()})
                    </span>
                  </div>
                  <Link
                    href="/pricing"
                    className="text-sm text-yellow-400 hover:text-yellow-300 underline flex-shrink-0"
                  >
                    Upgrade
                  </Link>
                </div>
              );
            }
            return null;
          })()}

        {BILLING_ENABLED &&
          accessStatus?.subscription &&
          (() => {
            const { repliesUsed, replyLimit } = accessStatus.subscription;
            const pct = Math.round((repliesUsed / replyLimit) * 100);
            if (repliesUsed >= replyLimit) {
              return (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3 w-fit ml-auto">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <span className="text-red-400 font-medium">
                      Monthly reply limit reached
                    </span>
                    <span className="text-red-400/80 ml-2">
                      ({repliesUsed.toLocaleString()}/
                      {replyLimit.toLocaleString()})
                    </span>
                  </div>
                  <Link
                    href="/pricing"
                    className="text-sm text-red-400 hover:text-red-300 underline flex-shrink-0"
                  >
                    Upgrade
                  </Link>
                </div>
              );
            }
            if (pct >= 80) {
              return (
                <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center gap-3 w-fit ml-auto">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div>
                    <span className="text-yellow-400 font-medium">
                      {pct}% of monthly reply limit used
                    </span>
                    <span className="text-yellow-400/80 ml-2">
                      ({repliesUsed.toLocaleString()}/
                      {replyLimit.toLocaleString()})
                    </span>
                  </div>
                  <Link
                    href="/pricing"
                    className="text-sm text-yellow-400 hover:text-yellow-300 underline flex-shrink-0"
                  >
                    Upgrade
                  </Link>
                </div>
              );
            }
            return null;
          })()}

        <div className="sticky top-[60px] z-10 bg-surface -mx-4 px-4 pt-4 pb-4 -mt-1">
          {(isCancelling || batchProgress || (!batchProgress && getCommentsProgress.size > 0)) &&
            (() => {
              if (isCancelling) {
                return (
                  <div className="mb-3 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg w-fit ml-auto">
                    <h3 className="text-yellow-400 font-semibold mb-2">Collecting comments</h3>
                    <div className="flex items-center gap-3">
                      <Spinner size="md" />
                      <span className="text-yellow-400 font-medium">Cancelling...</span>
                    </div>
                  </div>
                );
              }
              if (batchProgress) {
                return (
                  <div className="mb-3 p-3 bg-accent-cyan-muted-20 border border-accent-cyan-muted-half rounded-lg w-fit ml-auto">
                    <h3 className="text-accent-cyan-text font-semibold mb-2">Collecting comments</h3>
                    <div className="flex items-center gap-3">
                      <Spinner size="md" />
                      <div>
                        <span className="text-accent-cyan-text font-medium">
                          Post {batchProgress.currentVideoIndex}/
                          {batchProgress.totalVideos}
                        </span>
                        <span className="text-accent-cyan-text/80 ml-2">
                          ({batchProgress.totalComments} comments)
                        </span>
                      </div>
                      <button
                        onClick={handleCancelScraping}
                        className="text-accent-cyan-text/60 hover:text-accent-cyan-text border border-accent-cyan-text/30 hover:border-accent-cyan-text/60 rounded px-2.5 py-0.5 text-sm cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }
              const progress = Array.from(getCommentsProgress.values())[0];
              if (!progress || progress.status === "complete") return null;
              return (
                <div className="mb-3 p-3 bg-accent-cyan-muted-20 border border-accent-cyan-muted-half rounded-lg w-fit ml-auto">
                  <h3 className="text-accent-cyan-text font-semibold mb-2">Collecting comments</h3>
                  <div className="flex items-center gap-3">
                    <Spinner size="md" />
                    <span className="text-accent-cyan-text font-medium">
                      {progress.message || "Collecting comments..."}
                    </span>
                    <button
                      onClick={handleCancelScraping}
                      className="text-accent-cyan-text/60 hover:text-accent-cyan-text border border-accent-cyan-text/30 hover:border-accent-cyan-text/60 rounded px-2.5 py-0.5 text-sm cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })()}

          <TabNavigation
            activeTab={activeTab}
            onTabChange={setTab}
            postCount={videos.length}
            commentCount={totalCommentCount}
            commenterCount={totalCommenterCount}
          />
        </div>

        <div className={`grid grid-cols-1 gap-6 ${activeTab === "posts" ? "" : "lg:grid-cols-[3fr_2fr]"}`}>
          <div>
            <div className={activeTab !== "posts" ? "hidden" : ""}>
              <PostsGrid
                videos={videos}
                loading={videosLoading}
                getCommentsProgress={getCommentsProgress}
                commentCountsByVideo={commentCountsByVideo}
                selectedVideoIds={selectedVideoIds}
                onSelectedVideoIdsChange={setSelectedVideoIds}
                onGetComments={getCommentsForVideos}
                onRemoveVideos={handleRemoveVideosWithComments}
                isRemovingVideos={isRemovingVideos}
                onViewPostComments={handleViewPostComments}
                onPostSelectionChange={handlePostSelectionChange}
                isScraping={isScraping}
                postLimitInput={postLimitInput}
                onPostLimitChange={setPostLimitInput}
                onPostLimitBlur={handlePostLimitBlur}
                commentLimitReached={commentLimitReached}
              />
            </div>

            <div className={activeTab !== "comments" ? "hidden" : ""}>
              <TabContentContainer>
                <CommentTable
                  comments={comments}
                  selectedIds={selectedCommentIds}
                  onSelectComment={handleSelectComment}
                  onSelectRange={handleSelectRange}
                  onSelectFiltered={handleSelectFiltered}
                  onRemoveSelected={handleRemoveSelected}
                  onRemoveComment={handleRemoveComment}
                  onReplyComment={handleReplyComment}
                  videoIdFilter={selectedPostId}
                  videoThumbnails={videoThumbnailMap}
                  onLoadMore={loadMore}
                  hasMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  isInitialLoading={loading}
                  replyingCommentId={replyingCommentId}
                  searchingMatchesCommentId={searchingMatchesCommentId}
                  search={commentSearch}
                  onSearchChange={setCommentSearch}
                  sort={commentSort}
                  onSortChange={handleSortChange}
                  isActive={activeTab === "comments"}
                  translationEnabled={translationEnabled}
                  translatingIds={translatingIds}
                  onTranslateComment={handleTranslateComment}
                  targetLanguage={targetLanguage}
                  onFetchReplies={fetchRepliesForThread}
                  needsReplyFetch={hideOwnReplies || !!commentSearch}
                  isDeletingSelected={isDeletingSelected}
                  headerContent={
                    <>
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-foreground">
                          Comments
                        </h2>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Settings />}
                          onClick={() => setSettingsModalOpen(true)}
                        >
                          Settings
                        </Button>
                      </div>
                      {selectedVideo && (
                        <div className="mt-3">
                          <SelectedPostContext
                            video={selectedVideo}
                            commentCount={filteredCommentCount}
                            onShowAllComments={clearPostFilter}
                          />
                        </div>
                      )}
                      {selectedPostId && !selectedVideo && (
                        <div className="mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearPostFilter}
                          >
                            Clear post filter
                          </Button>
                        </div>
                      )}
                    </>
                  }
                />
              </TabContentContainer>
            </div>

            <div className={activeTab !== "commenters" ? "hidden" : ""}>
              <TabContentContainer>
                <CommenterTable
                  commenters={filteredCommenters}
                  selectedCommentIds={selectedCommentIds}
                  onSelectComment={handleSelectComment}
                  onRemoveSelected={handleRemoveSelected}
                  onRemoveComment={handleRemoveComment}
                  onReplyComment={handleReplyComment}
                  videoThumbnails={videoThumbnailMap}
                  isLoading={commentersLoading}
                  replyingCommentId={replyingCommentId}
                  searchingMatchesCommentId={searchingMatchesCommentId}
                  onLoadMore={loadMoreCommenters}
                  hasMore={hasMoreCommenters}
                  isLoadingMore={isLoadingMoreCommenters}
                  search={commenterSearch}
                  onSearchChange={setCommenterSearch}
                  translationEnabled={translationEnabled}
                  translatingIds={translatingIds}
                  onTranslateComment={handleTranslateComment}
                  targetLanguage={targetLanguage}
                  headerContent={
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-foreground">
                        Commenters
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Settings />}
                        onClick={() => setSettingsModalOpen(true)}
                      >
                        Settings
                      </Button>
                    </div>
                  }
                />
              </TabContentContainer>
            </div>
          </div>

          <div
            className={`space-y-4 sticky top-[130px] self-start max-h-[calc(100vh-150px)] overflow-y-auto ${activeTab === "posts" ? "hidden lg:hidden" : ""}`}
          >
            <ReplyComposer
              selectedComments={selectedCommentsForDisplay}
              selectedCount={selectedCommentIds.size}
              onAddToQueue={handleAddToQueue}
              disabled={isReplying || replyLimitReached || isTranslatingReplies}
              replyLimitReached={replyLimitReached}
              translationEnabled={translationEnabled}
              targetLanguage={targetLanguage}
              translateRepliesEnabled={translateRepliesEnabled}
              onTranslateRepliesToggle={setTranslateRepliesEnabled}
              isTranslatingReplies={isTranslatingReplies}
            />
            <QueuePanel
              queuedComments={queuedComments}
              onDequeue={handleDequeue}
              onClearQueue={handleClearQueue}
              onStartReply={handleStartQueueReply}
              onStopReply={stopBulkReply}
              isReplying={isReplying}
              bulkReplyProgress={bulkReplyProgress}
              replyStatusMessage={replyStatusMessage}
              replyLimitReached={replyLimitReached}
              replyBudget={replyBudget}
            />
          </div>
        </div>
      </main>

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        ignoreList={ignoreList}
        onAddToIgnoreList={addToIgnoreList}
        onRemoveFromIgnoreList={removeFromIgnoreList}
        hideOwnReplies={hideOwnReplies}
        onHideOwnRepliesChange={saveHideOwnReplies}
        hideMissingComments={hideMissingComments}
        onHideMissingCommentsChange={saveHideMissingComments}
        accountHandle={accountHandle}
        onAccountHandleChange={saveAccountHandle}
      />

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({
            isOpen: false,
            commentId: "",
            commentText: "",
            matchingIds: [],
          })
        }
        matchCount={deleteModal.matchingIds.length}
        commentText={deleteModal.commentText}
        onDeleteAll={handleDeleteAll}
        onDeleteOne={handleDeleteOne}
      />

      <AddToIgnoreListModal
        isOpen={ignoreListModal.isOpen}
        onClose={() => setIgnoreListModal({ isOpen: false, commentText: "" })}
        commentText={ignoreListModal.commentText}
        onConfirm={handleAddToIgnoreList}
        onSkip={handleSkipIgnoreList}
      />

      {scrapeReport &&
        (BILLING_ENABLED && scrapeReport.limitReached ? (
          <LimitReachedModal
            isOpen={true}
            onClose={closeScrapeReport}
            type="comments"
            used={accessStatus?.subscription?.monthlyUsed ?? 0}
            limit={accessStatus?.subscription?.monthlyLimit ?? 0}
            plan={currentPlan}
            scrapeStats={scrapeReport.stats}
          />
        ) : (
          <ScrapeReportModal
            isOpen={true}
            onClose={closeScrapeReport}
            stats={scrapeReport.stats}
          />
        ))}

      {BILLING_ENABLED && replyLimitModal && (
        <LimitReachedModal
          isOpen={true}
          onClose={() => setReplyLimitModal(null)}
          type="replies"
          used={repliesUsed}
          limit={replyLimit}
          plan={currentPlan}
          replyStats={replyLimitModal}
        />
      )}

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        variant={toast.variant}
        {...(toast.duration !== undefined && { duration: toast.duration })}
      />

      <Toast
        isVisible={replyReport !== null}
        onClose={() => setReplyReport(null)}
        duration={10000}
        variant={
          replyReport && replyReport.failed > 0 && replyReport.completed === 0
            ? "error"
            : "success"
        }
      >
        {replyReport && (
          <div className="text-sm">
            <span className="font-medium">Reply complete</span>
            <span className="text-foreground-muted"> — </span>
            <span className="text-green-400">{replyReport.completed} sent</span>
            {replyReport.detectionFailed > 0 && (
              <span className="text-yellow-400">
                , {replyReport.detectionFailed} sent but not verified
              </span>
            )}
            {replyReport.failed > 0 && (
              <span className="text-red-400">
                , {replyReport.failed} failed
              </span>
            )}
            {replyReport.commentNotFound > 0 && (
              <span className="text-yellow-400">
                , {replyReport.commentNotFound} not found
              </span>
            )}
            {replyReport.mentionFailed > 0 && (
              <span className="text-orange-400">
                , {replyReport.mentionFailed} mention failed
              </span>
            )}
          </div>
        )}
      </Toast>
    </div>
  );
}
