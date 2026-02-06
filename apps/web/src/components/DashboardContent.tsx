"use client";

import { AddToIgnoreListModal } from "@/components/AddToIgnoreListModal";
import { BulkReplyReportModal } from "@/components/BulkReplyReportModal";
import { Button } from "@/components/Button";
import { CommentNotFoundModal } from "@/components/CommentNotFoundModal";
import { CommentTable, SortOption } from "@/components/CommentTable";
import { CommenterTable } from "@/components/CommenterTable";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { MissingCommentChoiceModal } from "@/components/MissingCommentChoiceModal";
import { PostsGrid } from "@/components/PostsGrid";
import { ReplyComposer } from "@/components/ReplyComposer";
import { ScrapeReportModal } from "@/components/ScrapeReportModal";
import { SelectedPostContext } from "@/components/SelectedPostContext";
import { SettingsTab } from "@/components/SettingsTab";
import { Spinner } from "@/components/Spinner";
import { TabContentContainer } from "@/components/TabContentContainer";
import { TabNavigation } from "@/components/TabNavigation";
import { Toast } from "@/components/Toast";
import { useCommentCounts } from "@/hooks/useCommentCounts";
import { useCommentData } from "@/hooks/useCommentData";
import { useCommenterData } from "@/hooks/useCommenterData";
import { useDashboardUrl } from "@/hooks/useDashboardUrl";
import { useIgnoreList } from "@/hooks/useIgnoreList";
import { useMessaging } from "@/hooks/useMessaging";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useVideoData } from "@/hooks/useVideoData";
import { ScrapedComment } from "@/utils/constants";
import { PauseCircle, X } from "lucide-react";
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
  const {
    activeTab,
    selectedPostId,
    setTab,
    setSelectedPost,
    clearPostFilter,
  } = useDashboardUrl();

  const [commentSort, setCommentSort] = useState<SortOption>("newest");

  const handleSortChange = useCallback((newSort: SortOption) => {
    window.scrollTo({ top: 0 });
    setCommentSort(newSort);
  }, []);

  const {
    comments: allComments,
    commentLimit,
    postLimit,
    hideOwnReplies,
    deleteMissingComments,
    loading,
    error,
    removeComments,
    updateComment,
    saveCommentLimit,
    savePostLimit,
    saveHideOwnReplies,
    saveDeleteMissingComments,
    addOptimisticComment,
    loadMore,
    hasMore,
    isLoadingMore,
    findMatchingComments,
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
      updateComment(commentId, {
        repliedTo: true,
        repliedAt: new Date().toISOString(),
      });
      setSelectedComment(null);
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
    replyProgress,
    bulkReplyProgress,
    error: replyError,
    replyToComment,
    startBulkReply,
    stopBulkReply,
    clearError,
  } = useMessaging({
    onReplyComplete: handleReplyComplete,
    onPostedReply: addOptimisticComment,
  });

  const {
    videos,
    loading: videosLoading,
    getCommentsProgress,
    getCommentsForVideos,
    removeVideos: removeVideosList,
    scrapingState,
    batchProgress,
    isScraping,
    cancelScraping,
    scrapeReport,
    closeScrapeReport,
  } = useVideoData();

  const { ignoreList, addToIgnoreList, removeFromIgnoreList } = useIgnoreList();

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
  const [selectedComment, setSelectedComment] = useState<ScrapedComment | null>(
    null,
  );
  const [searchingMatchesCommentId, setSearchingMatchesCommentId] = useState<
    string | null
  >(null);
  const [postLimitInput, setPostLimitInput] = useState(String(postLimit));
  const [commentLimitInput, setCommentLimitInput] = useState(
    String(commentLimit),
  );

  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [composerResetTrigger, setComposerResetTrigger] = useState(0);

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

  const [toast, setToast] = useState({ isVisible: false, message: "" });
  const [commentNotFoundModal, setCommentNotFoundModal] = useState<{
    isOpen: boolean;
    commentId: string | null;
  }>({ isOpen: false, commentId: null });

  const [missingCommentChoiceModal, setMissingCommentChoiceModal] = useState<{
    isOpen: boolean;
    pendingMessages: string[];
  }>({ isOpen: false, pendingMessages: [] });

  const [bulkReplyReportModal, setBulkReplyReportModal] = useState<{
    isOpen: boolean;
    stats: { completed: number; failed: number; skipped: number };
  }>({ isOpen: false, stats: { completed: 0, failed: 0, skipped: 0 } });

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
    setCommentLimitInput(String(commentLimit));
  }, [commentLimit]);

  useEffect(() => {
    if (error && error !== dismissedError) {
      setDismissedError(null);
    }
  }, [error, dismissedError]);

  useEffect(() => {
    if (replyError === "Comment not found" && selectedComment) {
      setCommentNotFoundModal({ isOpen: true, commentId: selectedComment.id });
    }
  }, [replyError, selectedComment]);

  useEffect(() => {
    if (bulkReplyProgress?.status === "complete") {
      setBulkReplyReportModal({
        isOpen: true,
        stats: {
          completed: bulkReplyProgress.completed,
          failed: bulkReplyProgress.failed,
          skipped: bulkReplyProgress.skipped,
        },
      });
    }
  }, [bulkReplyProgress]);

  const handlePostLimitBlur = useCallback(() => {
    const parsed = parseInt(postLimitInput);
    const value = isNaN(parsed) || parsed < 1 ? 50 : parsed;
    setPostLimitInput(String(value));
    savePostLimit(value);
  }, [postLimitInput, savePostLimit]);

  const handleCommentLimitBlur = useCallback(() => {
    const parsed = parseInt(commentLimitInput);
    const value = isNaN(parsed) || parsed < 1 ? 100 : parsed;
    setCommentLimitInput(String(value));
    saveCommentLimit(value);
  }, [commentLimitInput, saveCommentLimit]);

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
    setSelectedComment(comment);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedComment(null);
    setSelectedCommentIds(new Set());
  }, []);

  const handleReplyFromComposer = useCallback(
    (message: string) => {
      if (!selectedComment) return;
      replyToComment(selectedComment, message);
    },
    [selectedComment, replyToComment],
  );

  const handleBulkReply = useCallback(
    (messages: string[]) => {
      if (selectedCommentIds.size === 0) return;
      if (deleteMissingComments === null) {
        setMissingCommentChoiceModal({
          isOpen: true,
          pendingMessages: messages,
        });
        return;
      }
      startBulkReply(
        Array.from(selectedCommentIds),
        messages,
        deleteMissingComments,
      );
    },
    [selectedCommentIds, startBulkReply, deleteMissingComments],
  );

  const handleMissingCommentChoiceSkip = useCallback(() => {
    saveDeleteMissingComments(false);
    startBulkReply(
      Array.from(selectedCommentIds),
      missingCommentChoiceModal.pendingMessages,
      false,
    );
    setMissingCommentChoiceModal({ isOpen: false, pendingMessages: [] });
  }, [
    selectedCommentIds,
    missingCommentChoiceModal.pendingMessages,
    startBulkReply,
    saveDeleteMissingComments,
  ]);

  const handleMissingCommentChoiceDelete = useCallback(() => {
    saveDeleteMissingComments(true);
    startBulkReply(
      Array.from(selectedCommentIds),
      missingCommentChoiceModal.pendingMessages,
      true,
    );
    setMissingCommentChoiceModal({ isOpen: false, pendingMessages: [] });
  }, [
    selectedCommentIds,
    missingCommentChoiceModal.pendingMessages,
    startBulkReply,
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

  const handleCommentNotFoundDelete = useCallback(() => {
    if (commentNotFoundModal.commentId) {
      removeComments([commentNotFoundModal.commentId]);
      setSelectedCommentIds((prev) => {
        const next = new Set(prev);
        next.delete(commentNotFoundModal.commentId!);
        return next;
      });
      showToast("Removed 1 comment");
    }
    setCommentNotFoundModal({ isOpen: false, commentId: null });
    setSelectedComment(null);
    clearError();
  }, [commentNotFoundModal.commentId, removeComments, showToast, clearError]);

  const handleCommentNotFoundClose = useCallback(() => {
    setCommentNotFoundModal({ isOpen: false, commentId: null });
    setSelectedComment(null);
    clearError();
  }, [clearError]);

  return (
    <div className="min-h-content bg-surface">
      <main className="max-w-7xl mx-auto px-4 py-6">
        {scrapingState?.isPaused && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center gap-3">
            <PauseCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <span className="text-yellow-400 font-medium">
                Scraping Paused
              </span>
              <span className="text-yellow-400/80 ml-2">
                Return to the TikTok tab to continue scraping.
              </span>
            </div>
          </div>
        )}

        {batchProgress && !scrapingState?.isPaused && (
          <div className="mb-6 p-4 bg-accent-cyan-muted/20 border border-accent-cyan-muted/50 rounded-lg flex items-center gap-3">
            <Spinner size="md" />
            <div>
              <span className="text-accent-cyan-text font-medium">
                Scraping post {batchProgress.currentVideoIndex}/
                {batchProgress.totalVideos}
              </span>
              <span className="text-accent-cyan-text/80 ml-2">
                ({batchProgress.totalComments} comments)
              </span>
            </div>
          </div>
        )}

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

        <div className="sticky top-[60px] z-10 bg-surface py-4 -mx-4 px-4 -mt-1">
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
                isScraping={isScraping}
                onCancelScraping={handleCancelScraping}
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
                  replyingCommentId={replyProgress?.commentId}
                  searchingMatchesCommentId={searchingMatchesCommentId}
                  sort={commentSort}
                  onSortChange={handleSortChange}
                  isActive={activeTab === "comments"}
                  headerContent={
                    <>
                      <h2 className="text-lg font-medium text-foreground">
                        Comments
                      </h2>
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
                  replyingCommentId={replyProgress?.commentId}
                  searchingMatchesCommentId={searchingMatchesCommentId}
                  onLoadMore={loadMoreCommenters}
                  hasMore={hasMoreCommenters}
                  isLoadingMore={isLoadingMoreCommenters}
                  search={commenterSearch}
                  onSearchChange={setCommenterSearch}
                  headerContent={
                    <h2 className="text-lg font-medium text-foreground">
                      Commenters
                    </h2>
                  }
                />
              </TabContentContainer>
            </div>

            <div className={activeTab !== "settings" ? "hidden" : ""}>
              <SettingsTab
                postLimitInput={postLimitInput}
                commentLimitInput={commentLimitInput}
                onPostLimitChange={setPostLimitInput}
                onCommentLimitChange={setCommentLimitInput}
                onPostLimitBlur={handlePostLimitBlur}
                onCommentLimitBlur={handleCommentLimitBlur}
                ignoreList={ignoreList}
                onAddToIgnoreList={addToIgnoreList}
                onRemoveFromIgnoreList={removeFromIgnoreList}
                hideOwnReplies={hideOwnReplies}
                onHideOwnRepliesChange={saveHideOwnReplies}
                deleteMissingComments={deleteMissingComments}
                onDeleteMissingCommentsChange={saveDeleteMissingComments}
              />
            </div>
          </div>

          <div
            className={`space-y-6 sticky top-[130px] self-start ${activeTab === "posts" ? "hidden lg:hidden" : ""}`}
          >
            <ReplyComposer
              selectedComment={selectedComment}
              selectedComments={selectedCommentsForDisplay}
              selectedCount={selectedCommentIds.size}
              onSend={handleReplyFromComposer}
              onBulkSend={handleBulkReply}
              onClearSelection={handleClearSelection}
              onToggleComment={handleSelectComment}
              replyProgress={replyProgress}
              bulkReplyProgress={bulkReplyProgress}
              onStopBulkReply={stopBulkReply}
              disabled={isReplying}
              resetTrigger={composerResetTrigger}
            />
          </div>
        </div>
      </main>

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

      {scrapeReport && (
        <ScrapeReportModal
          isOpen={true}
          onClose={closeScrapeReport}
          stats={scrapeReport.stats}
        />
      )}

      <CommentNotFoundModal
        isOpen={commentNotFoundModal.isOpen}
        onClose={handleCommentNotFoundClose}
        onDelete={handleCommentNotFoundDelete}
      />

      <MissingCommentChoiceModal
        isOpen={missingCommentChoiceModal.isOpen}
        onSkip={handleMissingCommentChoiceSkip}
        onDelete={handleMissingCommentChoiceDelete}
      />

      <BulkReplyReportModal
        isOpen={bulkReplyReportModal.isOpen}
        onClose={() => {
          setBulkReplyReportModal({
            isOpen: false,
            stats: { completed: 0, failed: 0, skipped: 0 },
          });
          setComposerResetTrigger((prev) => prev + 1);
        }}
        stats={bulkReplyReportModal.stats}
        deleteMissingComments={deleteMissingComments}
      />

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}
