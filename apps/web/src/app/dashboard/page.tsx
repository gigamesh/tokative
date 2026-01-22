"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { CommentTable } from "@/components/CommentTable";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { MessageComposer } from "@/components/MessageComposer";
import { PostsGrid } from "@/components/PostsGrid";
import { TabNavigation } from "@/components/TabNavigation";
import { SelectedPostContext } from "@/components/SelectedPostContext";
import { useDashboardUrl } from "@/hooks/useDashboardUrl";
import { useMessaging } from "@/hooks/useMessaging";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useUserData } from "@/hooks/useUserData";
import { useVideoData } from "@/hooks/useVideoData";
import { ScrapedUser } from "@/utils/constants";

function DashboardContent() {
  const {
    users,
    commentLimit,
    postLimit,
    loading,
    error,
    removeUser,
    removeUsers,
    saveCommentLimit,
    savePostLimit,
  } = useUserData();

  const {
    isSending,
    isReplying,
    currentProgress,
    replyProgress,
    error: messagingError,
    sendMessage,
    replyToComment,
  } = useMessaging();

  const {
    videos,
    loading: videosLoading,
    getCommentsProgress,
    getCommentsForVideos,
    removeVideos: removeVideosList,
  } = useVideoData();

  const {
    activeTab,
    selectedPostId,
    setTab,
    setSelectedPost,
    clearPostFilter,
  } = useDashboardUrl();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<ScrapedUser | null>(null);
  const [composerMode, setComposerMode] = useState<"message" | "reply">("message");
  const [postLimitInput, setPostLimitInput] = useState(String(postLimit));
  const [commentLimitInput, setCommentLimitInput] = useState(String(commentLimit));

  useScrollRestore("dashboard-scroll", !loading && !videosLoading);

  useEffect(() => {
    setPostLimitInput(String(postLimit));
  }, [postLimit]);

  useEffect(() => {
    setCommentLimitInput(String(commentLimit));
  }, [commentLimit]);

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
    for (const user of users) {
      if (user.videoId) {
        counts.set(user.videoId, (counts.get(user.videoId) || 0) + 1);
      }
    }
    return counts;
  }, [users]);

  const filteredCommentCount = useMemo(() => {
    if (!selectedPostId) return 0;
    return commentCountsByVideo.get(selectedPostId) ?? 0;
  }, [selectedPostId, commentCountsByVideo]);

  const handleSelectUser = useCallback((userId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  }, []);

  const handleSelectFiltered = useCallback(
    (userIds: string[], selected: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (selected) {
          userIds.forEach((id) => next.add(id));
        } else {
          userIds.forEach((id) => next.delete(id));
        }
        return next;
      });
    },
    []
  );

  const handleRemoveSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    removeUsers(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, removeUsers]);

  const handleSendToUser = useCallback((user: ScrapedUser) => {
    setSelectedUser(user);
    setComposerMode("message");
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedUser(null);
  }, []);

  const handleSendFromComposer = useCallback(
    (message: string) => {
      if (!selectedUser) return;
      if (composerMode === "reply") {
        replyToComment(selectedUser, message);
      } else {
        sendMessage(selectedUser, message);
      }
      setSelectedUser(null);
    },
    [selectedUser, composerMode, sendMessage, replyToComment]
  );

  const handleReplyToUser = useCallback((user: ScrapedUser) => {
    setSelectedUser(user);
    setComposerMode("reply");
  }, []);

  const handleViewPostComments = useCallback(
    (videoId: string) => {
      setSelectedPost(videoId);
    },
    [setSelectedPost]
  );

  return (
    <div className="min-h-screen bg-tiktok-dark">
      <header className="border-b border-gray-800 bg-tiktok-gray/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">TikTok Buddy</h1>
          <ConnectionStatus />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {(error || messagingError) && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error || messagingError}
          </div>
        )}

        <div className="mb-6 flex gap-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Post Limit</label>
            <input
              type="number"
              value={postLimitInput}
              onChange={(e) => setPostLimitInput(e.target.value)}
              onBlur={handlePostLimitBlur}
              min={1}
              className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-tiktok-red"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Comment Limit</label>
            <input
              type="number"
              value={commentLimitInput}
              onChange={(e) => setCommentLimitInput(e.target.value)}
              onBlur={handleCommentLimitBlur}
              min={1}
              className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-tiktok-red"
            />
          </div>
        </div>

        <div className="mb-6">
          <TabNavigation
            activeTab={activeTab}
            onTabChange={setTab}
            postCount={videos.length}
            commentCount={users.length}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {activeTab === "posts" && (
              <PostsGrid
                videos={videos}
                loading={videosLoading}
                getCommentsProgress={getCommentsProgress}
                commentCountsByVideo={commentCountsByVideo}
                onGetComments={getCommentsForVideos}
                onRemoveVideos={removeVideosList}
                onViewPostComments={handleViewPostComments}
              />
            )}

            {activeTab === "comments" && (
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

                {loading ? (
                  <div className="text-center py-12 text-gray-500">
                    Loading comments...
                  </div>
                ) : (
                  <CommentTable
                    users={users}
                    selectedIds={selectedIds}
                    onSelectUser={handleSelectUser}
                    onSelectFiltered={handleSelectFiltered}
                    onRemoveUser={removeUser}
                    onRemoveSelected={handleRemoveSelected}
                    onFetchComments={getCommentsForVideos}
                    onSendMessage={handleSendToUser}
                    onReplyComment={handleReplyToUser}
                    videoIdFilter={selectedPostId}
                  />
                )}
              </div>
            )}
          </div>

          <div className="space-y-6 sticky top-24 self-start">
            <MessageComposer
              selectedUser={selectedUser}
              mode={composerMode}
              onSend={handleSendFromComposer}
              onClearSelection={handleClearSelection}
              disabled={isSending || isReplying}
            />

            {currentProgress && (
              <div className="bg-tiktok-gray rounded-lg p-4">
                <h3 className="font-medium text-white mb-2">Sending Status</h3>
                <p className="text-sm text-gray-400">
                  {currentProgress.status === "opening" && "Opening profile..."}
                  {currentProgress.status === "typing" && "Typing message..."}
                  {currentProgress.status === "sending" && "Sending message..."}
                  {currentProgress.status === "complete" && "Message sent!"}
                  {currentProgress.status === "error" && (
                    <span className="text-red-400">
                      Error: {currentProgress.message}
                    </span>
                  )}
                </p>
              </div>
            )}

            {replyProgress && (
              <div className="bg-tiktok-gray rounded-lg p-4">
                <h3 className="font-medium text-white mb-2">Reply Status</h3>
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardLoading() {
  return (
    <div className="min-h-screen bg-tiktok-dark">
      <header className="border-b border-gray-800 bg-tiktok-gray/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">TikTok Buddy</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </main>
    </div>
  );
}
