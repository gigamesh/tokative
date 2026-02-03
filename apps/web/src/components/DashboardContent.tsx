"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CommentTable, CommentTableSkeleton } from "@/components/CommentTable";
import { Header } from "@/components/Header";
import { ReplyComposer } from "@/components/ReplyComposer";
import { PostsGrid } from "@/components/PostsGrid";
import { TabNavigation } from "@/components/TabNavigation";
import { SelectedPostContext } from "@/components/SelectedPostContext";
import { SettingsTab } from "@/components/SettingsTab";
import { DeleteConfirmationModal } from "@/components/DeleteConfirmationModal";
import { AddToIgnoreListModal } from "@/components/AddToIgnoreListModal";
import { ScrapeReportModal } from "@/components/ScrapeReportModal";
import { Toast } from "@/components/Toast";
import { SetupBanner } from "@/components/SetupBanner";
import { useDashboardUrl } from "@/hooks/useDashboardUrl";
import { useMessaging } from "@/hooks/useMessaging";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useCommentData } from "@/hooks/useCommentData";
import { useVideoData } from "@/hooks/useVideoData";
import { useIgnoreList } from "@/hooks/useIgnoreList";
import { ScrapedComment } from "@/utils/constants";

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
    comments: allComments,
    commentLimit,
    postLimit,
    hideOwnReplies,
    loading,
    error,
    removeComments,
    updateComment,
    saveCommentLimit,
    savePostLimit,
    saveHideOwnReplies,
    addOptimisticComment,
    loadMore,
    hasMore,
    isLoadingMore,
  } = useCommentData();

  const comments = useMemo(() => {
    if (!hideOwnReplies) return allComments;
    return allComments.filter(c => c.source !== "app");
  }, [allComments, hideOwnReplies]);

  const handleReplyComplete = useCallback(
    (commentId: string) => {
      updateComment(commentId, {
        replySent: true,
        repliedAt: new Date().toISOString(),
      });
      setSelectedComment(null);
    },
    [updateComment]
  );

  const {
    isReplying,
    replyProgress,
    bulkReplyProgress,
    error: replyError,
    replyToComment,
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
    removeVideos: removeVideosList,
    scrapingState,
    batchProgress,
    isScraping,
    cancelScraping,
    scrapeReport,
    closeScrapeReport,
  } = useVideoData();

  const {
    activeTab,
    selectedPostId,
    setTab,
    setSelectedPost,
    clearPostFilter,
  } = useDashboardUrl();

  const {
    ignoreList,
    addToIgnoreList,
    removeFromIgnoreList,
  } = useIgnoreList();

  const [selectedCommentIds, setSelectedCommentIds] = useState<Set<string>>(new Set());
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [selectedComment, setSelectedComment] = useState<ScrapedComment | null>(null);
  const [postLimitInput, setPostLimitInput] = useState(String(postLimit));
  const [commentLimitInput, setCommentLimitInput] = useState(String(commentLimit));

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

  const [toast, setToast] = useState({ isVisible: false, message: "" });

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

  // Reset dismissed error when a new error occurs
  useEffect(() => {
    const currentError = error || replyError;
    if (currentError && currentError !== dismissedError) {
      setDismissedError(null);
    }
  }, [error, replyError, dismissedError]);

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

  const commentCountsByVideo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const comment of comments) {
      if (comment.videoId) {
        counts.set(comment.videoId, (counts.get(comment.videoId) || 0) + 1);
      }
    }
    return counts;
  }, [comments]);

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

  const selectedCommentsForDisplay = useMemo(() => {
    const selected: ScrapedComment[] = [];
    const idsArray = Array.from(selectedCommentIds);
    for (let i = idsArray.length - 1; i >= 0 && selected.length < 2; i--) {
      const comment = comments.find(c => c.id === idsArray[i]);
      if (comment) selected.push(comment);
    }
    return selected;
  }, [comments, selectedCommentIds]);

  const getCommentIdsByVideoIds = useCallback(
    (videoIds: string[]) =>
      comments
        .filter((c) => c.videoId && videoIds.includes(c.videoId))
        .map((c) => c.id),
    [comments]
  );

  const handleSelectComment = useCallback((commentId: string, selected: boolean) => {
    setSelectedCommentIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(commentId);
      } else {
        next.delete(commentId);
      }
      return next;
    });
  }, []);

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
    []
  );

  const handleRemoveSelected = useCallback(() => {
    if (selectedCommentIds.size === 0) return;
    const count = selectedCommentIds.size;
    removeComments(Array.from(selectedCommentIds));
    setSelectedCommentIds(new Set());
    showToast(`Deleted ${count} comment${count > 1 ? "s" : ""}`);
  }, [selectedCommentIds, removeComments, showToast]);

  const handleRemoveComment = useCallback(
    (commentId: string) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;

      const matchingComments = comments.filter(
        (c) => c.id !== commentId && c.comment.trim() === comment.comment.trim()
      );

      if (matchingComments.length > 0) {
        setDeleteModal({
          isOpen: true,
          commentId,
          commentText: comment.comment,
          matchingIds: matchingComments.map((c) => c.id),
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
    },
    [comments, removeComments, showToast]
  );

  const handleDeleteOne = useCallback(() => {
    removeComments([deleteModal.commentId]);
    setSelectedCommentIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteModal.commentId);
      return next;
    });
    setDeleteModal({ isOpen: false, commentId: "", commentText: "", matchingIds: [] });
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
    setDeleteModal({ isOpen: false, commentId: "", commentText: "", matchingIds: [] });
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

  const handleReplyComment = useCallback(
    (comment: ScrapedComment) => {
      setSelectedComment(comment);
    },
    []
  );

  const handleClearSelection = useCallback(() => {
    setSelectedComment(null);
  }, []);

  const handleReplyFromComposer = useCallback(
    (message: string) => {
      if (!selectedComment) return;
      replyToComment(selectedComment, message);
    },
    [selectedComment, replyToComment]
  );

  const handleBulkReply = useCallback(
    (messages: string[]) => {
      if (selectedCommentIds.size === 0) return;
      startBulkReply(Array.from(selectedCommentIds), messages);
    },
    [selectedCommentIds, startBulkReply]
  );

  const handleViewPostComments = useCallback(
    (videoId: string) => {
      setSelectedPost(videoId);
    },
    [setSelectedPost]
  );

  const handlePostSelectionChange = useCallback(
    (videoIds: string[], selected: boolean) => {
      const commentIds = getCommentIdsByVideoIds(videoIds);
      setSelectedCommentIds((prev) => {
        const next = new Set(prev);
        commentIds.forEach((id) => (selected ? next.add(id) : next.delete(id)));
        return next;
      });
    },
    [getCommentIdsByVideoIds]
  );

  const handleRemoveVideosWithComments = useCallback(
    (videoIds: string[]) => {
      const commentIds = getCommentIdsByVideoIds(videoIds);
      if (commentIds.length > 0) {
        removeComments(commentIds);
      }
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
    [getCommentIdsByVideoIds, removeComments, removeVideosList]
  );

  const handleCancelScraping = useCallback(() => {
    cancelScraping();
  }, [cancelScraping]);

  return (
    <div className="min-h-screen bg-tiktok-dark">
      <Header showConnectionStatus />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <SetupBanner />

        {scrapingState?.isPaused && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="text-yellow-400 font-medium">Scraping Paused</span>
              <span className="text-yellow-400/80 ml-2">Return to the TikTok tab to continue scraping.</span>
            </div>
          </div>
        )}

        {batchProgress && !scrapingState?.isPaused && (
          <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div>
              <span className="text-blue-400 font-medium">
                Scraping post {batchProgress.currentVideoIndex}/{batchProgress.totalVideos}
              </span>
              <span className="text-blue-400/80 ml-2">({batchProgress.totalComments} comments)</span>
            </div>
          </div>
        )}

        {(error || replyError) && (error || replyError) !== dismissedError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-start justify-between gap-3">
            <span>{error || replyError}</span>
            <button
              onClick={() => setDismissedError(error || replyError || null)}
              className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
              aria-label="Dismiss error"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="mb-6">
          <TabNavigation
            activeTab={activeTab}
            onTabChange={setTab}
            postCount={videos.length}
            commentCount={comments.length}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className={activeTab === "posts" ? "" : "hidden"}>
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
                onCancelScraping={handleCancelScraping}
              />
            </div>

            <div className={activeTab === "comments" ? "" : "hidden"}>
              <div className="bg-tiktok-gray rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-white">Comments</h2>
                </div>

                {selectedVideo && (
                  <div className="mb-4">
                    <SelectedPostContext
                      video={selectedVideo}
                      commentCount={filteredCommentCount}
                      onShowAllComments={clearPostFilter}
                    />
                  </div>
                )}

                <CommentTable
                  comments={comments}
                  selectedIds={selectedCommentIds}
                  onSelectComment={handleSelectComment}
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
                />
              </div>
            </div>

            <div className={activeTab === "settings" ? "" : "hidden"}>
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
              />
            </div>
          </div>

          <div className="space-y-6 sticky top-24 self-start">
            <ReplyComposer
              selectedComment={selectedComment}
              selectedComments={selectedCommentsForDisplay}
              selectedCount={selectedCommentIds.size}
              onSend={handleReplyFromComposer}
              onBulkSend={handleBulkReply}
              onClearSelection={handleClearSelection}
              disabled={isReplying}
            />

            {replyProgress && (
              <div className="bg-tiktok-gray rounded-lg p-4">
                <h3 className="font-medium text-white mb-2">Reply Status</h3>
                <div className="flex items-center gap-2">
                  {replyProgress.status !== "complete" && replyProgress.status !== "error" && (
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  )}
                  <p className="text-sm text-gray-400">
                    {replyProgress.status === "navigating" && "Opening video..."}
                    {replyProgress.status === "finding" && "Finding comment..."}
                    {replyProgress.status === "replying" && "Posting reply..."}
                    {replyProgress.status === "complete" && "Reply posted!"}
                    {replyProgress.status === "error" && (
                      <span className="text-red-400">
                        Error: {replyProgress.message}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {bulkReplyProgress && bulkReplyProgress.status === "running" && (
              <div className="bg-tiktok-gray rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-white">Bulk Reply Progress</h3>
                  <button
                    onClick={stopBulkReply}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Stop
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">
                      {bulkReplyProgress.completed + bulkReplyProgress.failed} / {bulkReplyProgress.total}
                    </span>
                    {bulkReplyProgress.current && (
                      <span className="text-gray-500">@{bulkReplyProgress.current}</span>
                    )}
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${((bulkReplyProgress.completed + bulkReplyProgress.failed) / bulkReplyProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-400">{bulkReplyProgress.completed} sent</span>
                    {bulkReplyProgress.failed > 0 && (
                      <span className="text-red-400">{bulkReplyProgress.failed} failed</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, commentId: "", commentText: "", matchingIds: [] })}
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

      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}
