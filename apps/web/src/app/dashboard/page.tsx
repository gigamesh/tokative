"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
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

  useScrollRestore("dashboard-scroll", !loading && !videosLoading);

  const selectedVideo = useMemo(() => {
    if (!selectedPostId) return null;
    return videos.find((v) => v.videoId === selectedPostId) ?? null;
  }, [selectedPostId, videos]);

  const filteredCommentCount = useMemo(() => {
    if (!selectedPostId) return 0;
    return users.filter((u) => u.videoId === selectedPostId).length;
  }, [selectedPostId, users]);

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

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedIds(new Set(users.map((u) => u.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [users]
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
                postLimit={postLimit}
                onPostLimitChange={savePostLimit}
                onGetComments={getCommentsForVideos}
                onRemoveVideos={removeVideosList}
                onViewPostComments={handleViewPostComments}
              />
            )}

            {activeTab === "comments" && (
              <div className="bg-tiktok-gray rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium text-white">Comments</h2>
                  <div className="flex gap-2">
                    {selectedIds.size > 0 && (
                      <button
                        onClick={handleRemoveSelected}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                      >
                        Remove Selected ({selectedIds.size})
                      </button>
                    )}
                  </div>
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
                    commentLimit={commentLimit}
                    onSelectUser={handleSelectUser}
                    onSelectAll={handleSelectAll}
                    onRemoveUser={removeUser}
                    onSendMessage={handleSendToUser}
                    onReplyComment={handleReplyToUser}
                    onCommentLimitChange={saveCommentLimit}
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
