"use client";

import { AddToIgnoreListModal } from "@/components/AddToIgnoreListModal";
import { Button } from "@/components/Button";

import { CommentTable, SortOption } from "@/components/CommentTable";
import { CommenterTable } from "@/components/CommenterTable";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { LimitReachedModal } from "@/components/LimitReachedModal";
import { MissingCommentChoiceModal } from "@/components/MissingCommentChoiceModal";
import { PostsGrid } from "@/components/PostsGrid";
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
import { ScrapedComment } from "@/utils/constants";
import { api, BILLING_ENABLED, PLAN_LIMITS } from "@tokative/convex";
import { useQuery } from "convex/react";
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
    deleteMissingComments,
    loading,
    error,
    removeComments,
    updateComment,
    savePostLimit,
    saveHideOwnReplies,
    saveDeleteMissingComments,
    addOptimisticComment,
    loadMore,
    hasMore,
    isLoadingMore,
    findMatchingComments,
    search: commentSearch,
    setSearch: setCommentSearch,
  } = useCommentData({
    videoIdFilter: selectedPostId,
    sortOrder: commentSort === "newest" ? "desc" : "asc",
  });

  const comments = useMemo(() => {
    if (!hideOwnReplies) return allComments;
    return allComments.filter((c) => c.source !== "app");
  }, [allComments, hideOwnReplies]);

  const handleReplyComplete = useCallback(
    (commentId: string) => {
      const updates: Partial<ScrapedComment> = {
        repliedTo: true,
        repliedAt: new Date().toISOString(),
      };
      updateComment(commentId, updates);
      setSelectedCommentIds((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    },
    [updateComment],
  );

  const {
    isReplying,
    bulkReplyProgress,
    replyStatusMessage,
    startBulkReply,
    stopBulkReply,
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

  const [toast, setToast] = useState({ isVisible: false, message: "" });
  const [missingCommentChoiceModal, setMissingCommentChoiceModal] = useState<{
    isOpen: boolean;
    pendingMessages: string[];
  }>({ isOpen: false, pendingMessages: [] });

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [translateRepliesEnabled, setTranslateRepliesEnabled] = useState(false);

  const [replyReport, setReplyReport] = useState<{
    completed: number;
    failed: number;
    skipped: number;
  } | null>(null);
  const [replyLimitModal, setReplyLimitModal] = useState<{
    completed: number;
    failed: number;
    skipped: number;
  } | null>(null);

  const showToast = useCallback((message: string) => {
    setToast({ isVisible: true, message });
  }, []);

  const hideToast = useCallback(() => {
    setToast({ isVisible: false, message: "" });
  }, []);

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
      const stats = {
        completed: bulkReplyProgress.completed,
        failed: bulkReplyProgress.failed,
        skipped: bulkReplyProgress.skipped,
      };
      if (replyLimitReached) {
        setReplyLimitModal(stats);
      } else {
        setReplyReport(stats);
      }
    }
  }, [bulkReplyProgress, replyLimitReached]);

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

  const allCommentsFromCommenters = useMemo(() => {
    const all: ScrapedComment[] = [];
    for (const commenter of commenters) {
      all.push(...commenter.comments);
    }
    return all;
  }, [commenters]);

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

  const handleRemoveSelected = useCallback(() => {
    if (selectedCommentIds.size === 0) return;
    const count = selectedCommentIds.size;
    removeComments(Array.from(selectedCommentIds));
    setSelectedCommentIds(new Set());
    showToast(`Deleted ${count} comment${count > 1 ? "s" : ""}`);
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
  }, []);

  const executeBulkReply = useCallback(
    async (messages: string[], deleteMissing: boolean) => {
      const capped = selectedCommentsForDisplay.slice(0, replyBudget);

      if (translateRepliesEnabled && translationEnabled) {
        try {
          const pairs: Array<{
            text: string;
            targetLanguage: string;
            commentIdx: number;
            msgIdx: number;
          }> = [];
          for (let ci = 0; ci < capped.length; ci++) {
            const lang = capped[ci].detectedLanguage;
            if (!lang || lang === "other" || lang === targetLanguage) continue;
            for (let mi = 0; mi < messages.length; mi++) {
              pairs.push({
                text: messages[mi],
                targetLanguage: lang,
                commentIdx: ci,
                msgIdx: mi,
              });
            }
          }

          if (pairs.length > 0) {
            const deduped = new Map<string, number>();
            const dedupedList: Array<{ text: string; targetLanguage: string }> =
              [];
            for (const p of pairs) {
              const key = `${p.targetLanguage}:${p.text}`;
              if (!deduped.has(key)) {
                deduped.set(key, dedupedList.length);
                dedupedList.push({
                  text: p.text,
                  targetLanguage: p.targetLanguage,
                });
              }
            }

            const results = await translateReplies(dedupedList);
            if (results && results.length > 0) {
              for (let ci = 0; ci < capped.length; ci++) {
                const lang = capped[ci].detectedLanguage;
                if (!lang || lang === "other" || lang === targetLanguage)
                  continue;
                const msgIdx = ci % messages.length;
                const key = `${lang}:${messages[msgIdx]}`;
                const idx = deduped.get(key);
                if (idx !== undefined && results[idx]) {
                  capped[ci] = {
                    ...capped[ci],
                    messageToSend: results[idx].translatedText,
                  };
                }
              }
            }
          }
        } catch {
          showToast("Translation failed — sending original messages");
        }
      }

      startBulkReply(capped, messages, deleteMissing);
    },
    [
      selectedCommentsForDisplay,
      replyBudget,
      startBulkReply,
      translateRepliesEnabled,
      translationEnabled,
      targetLanguage,
      translateReplies,
      showToast,
    ],
  );

  const handleBulkReply = useCallback(
    (messages: string[]) => {
      if (selectedCommentIds.size === 0) return;
      if (replyLimitReached) {
        showToast("Monthly reply limit reached. Upgrade for more replies.");
        return;
      }
      if (deleteMissingComments === null) {
        setMissingCommentChoiceModal({
          isOpen: true,
          pendingMessages: messages,
        });
        return;
      }
      executeBulkReply(messages, deleteMissingComments);
    },
    [
      selectedCommentIds.size,
      replyLimitReached,
      deleteMissingComments,
      executeBulkReply,
      showToast,
    ],
  );

  const handleMissingCommentChoiceSkip = useCallback(() => {
    saveDeleteMissingComments(false);
    executeBulkReply(missingCommentChoiceModal.pendingMessages, false);
    setMissingCommentChoiceModal({ isOpen: false, pendingMessages: [] });
  }, [
    missingCommentChoiceModal.pendingMessages,
    executeBulkReply,
    saveDeleteMissingComments,
  ]);

  const handleMissingCommentChoiceDelete = useCallback(() => {
    saveDeleteMissingComments(true);
    executeBulkReply(missingCommentChoiceModal.pendingMessages, true);
    setMissingCommentChoiceModal({ isOpen: false, pendingMessages: [] });
  }, [
    missingCommentChoiceModal.pendingMessages,
    executeBulkReply,
    saveDeleteMissingComments,
  ]);

  const handleViewPostComments = useCallback(
    (videoId: string) => {
      setSelectedPost(videoId);
    },
    [setSelectedPost],
  );

  const handleRemoveVideosWithComments = useCallback(
    (videoIds: string[]) => {
      const commentIds = getCommentIdsByVideoIds(videoIds);
      removeVideosList(videoIds);
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
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-start justify-between gap-3">
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
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div className="flex-1">
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
                <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1">
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
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div className="flex-1">
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
                <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div className="flex-1">
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
          {isCancelling && (
            <div className="mb-3 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center gap-3">
              <Spinner size="md" />
              <span className="text-yellow-400 font-medium">Cancelling...</span>
            </div>
          )}

          {batchProgress && !isCancelling && (
            <div className="mb-3 p-3 bg-accent-cyan-muted/20 border border-accent-cyan-muted/50 rounded-lg flex items-center gap-3">
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
            </div>
          )}

          {!batchProgress &&
            !isCancelling &&
            getCommentsProgress.size > 0 &&
            (() => {
              const progress = Array.from(getCommentsProgress.values())[0];
              if (!progress || progress.status === "complete") return null;
              return (
                <div className="mb-3 p-3 bg-accent-cyan-muted/20 border border-accent-cyan-muted/50 rounded-lg flex items-center gap-3">
                  <Spinner size="md" />
                  <span className="text-accent-cyan-text font-medium">
                    {progress.message || "Collecting comments..."}
                  </span>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div
            className={`${activeTab === "posts" ? "lg:col-span-3" : "lg:col-span-2"}`}
          >
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
                onViewPostComments={handleViewPostComments}
                onPostSelectionChange={handlePostSelectionChange}
                isScraping={isScraping}
                isCancelling={isCancelling}
                onCancelScraping={handleCancelScraping}
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
                  replyingCommentId={null}
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
                  commenters={commenters}
                  selectedCommentIds={selectedCommentIds}
                  onSelectComment={handleSelectComment}
                  onRemoveSelected={handleRemoveSelected}
                  onRemoveComment={handleRemoveComment}
                  onReplyComment={handleReplyComment}
                  videoThumbnails={videoThumbnailMap}
                  isLoading={commentersLoading}
                  replyingCommentId={null}
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
            className={`space-y-6 sticky top-[130px] self-start ${activeTab === "posts" ? "hidden lg:hidden" : ""}`}
          >
            <ReplyComposer
              selectedComments={selectedCommentsForDisplay}
              selectedCount={selectedCommentIds.size}
              onSend={handleBulkReply}
              onClearSelection={handleClearSelection}
              onToggleComment={handleSelectComment}
              bulkReplyProgress={bulkReplyProgress}
              replyStatusMessage={replyStatusMessage}
              onStopBulkReply={stopBulkReply}
              disabled={isReplying || replyLimitReached || isTranslatingReplies}
              replyBudget={replyBudget}
              replyLimitReached={replyLimitReached}
              translationEnabled={translationEnabled}
              targetLanguage={targetLanguage}
              translateRepliesEnabled={translateRepliesEnabled}
              onTranslateRepliesToggle={setTranslateRepliesEnabled}
              isTranslatingReplies={isTranslatingReplies}
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
        deleteMissingComments={deleteMissingComments}
        onDeleteMissingCommentsChange={saveDeleteMissingComments}
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

      <MissingCommentChoiceModal
        isOpen={missingCommentChoiceModal.isOpen}
        onSkip={handleMissingCommentChoiceSkip}
        onDelete={handleMissingCommentChoiceDelete}
      />

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
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
            {replyReport.failed > 0 && (
              <span className="text-red-400">
                , {replyReport.failed} failed
              </span>
            )}
            {replyReport.skipped > 0 && (
              <span className="text-yellow-400">
                , {replyReport.skipped} skipped
              </span>
            )}
          </div>
        )}
      </Toast>
    </div>
  );
}
