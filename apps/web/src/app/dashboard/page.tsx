"use client";

import { useState, useEffect, useCallback } from "react";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { UserTable } from "@/components/UserTable";
import { MessageComposer } from "@/components/MessageComposer";
import { useUserData } from "@/hooks/useUserData";
import { useMessaging } from "@/hooks/useMessaging";
import { ScrapedUser } from "@/utils/constants";

export default function DashboardPage() {
  const {
    users,
    accountHandle,
    commentLimit,
    loading,
    error,
    scrapeProgress,
    isScrapingActive,
    startScraping,
    stopScraping,
    removeUser,
    removeUsers,
    saveAccountHandle,
    saveCommentLimit,
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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<ScrapedUser | null>(null);
  const [composerMode, setComposerMode] = useState<"message" | "reply">("message");
  const [commentLimitInput, setCommentLimitInput] = useState<string>("100");

  useEffect(() => {
    setCommentLimitInput(String(commentLimit));
  }, [commentLimit]);

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

  const handleSendToUser = useCallback(
    (user: ScrapedUser) => {
      setSelectedUser(user);
      setComposerMode("message");
    },
    []
  );

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

  const handleReplyToUser = useCallback(
    (user: ScrapedUser) => {
      setSelectedUser(user);
      setComposerMode("reply");
    },
    []
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-tiktok-gray rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">Scraping</h2>
                {isScrapingActive ? (
                  <button
                    onClick={stopScraping}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Stop Scraping
                  </button>
                ) : (
                  <button
                    onClick={() => startScraping()}
                    disabled={!accountHandle}
                    className="px-4 py-2 bg-tiktok-red hover:bg-tiktok-red/80 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    Start Scraping
                  </button>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">
                  Your TikTok Handle
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                    <input
                      type="text"
                      value={accountHandle}
                      onChange={(e) => saveAccountHandle(e.target.value)}
                      placeholder="yourhandle"
                      className="w-full pl-8 pr-3 py-2 bg-tiktok-dark border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter your handle to navigate to your profile for scraping
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">
                  Comment Limit
                </label>
                <input
                  type="number"
                  value={commentLimitInput}
                  onChange={(e) => setCommentLimitInput(e.target.value)}
                  onBlur={() => {
                    const parsed = parseInt(commentLimitInput);
                    const value = isNaN(parsed) || parsed < 1 ? 100 : parsed;
                    setCommentLimitInput(String(value));
                    saveCommentLimit(value);
                  }}
                  min={1}
                  className="w-32 px-3 py-2 bg-tiktok-dark border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum number of comments to scrape
                </p>
              </div>

              {scrapeProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">
                      {scrapeProgress.message}
                    </span>
                    <span className="text-white">
                      {scrapeProgress.newUsers} users found
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-tiktok-red transition-all duration-300"
                      style={{
                        width:
                          scrapeProgress.status === "complete"
                            ? "100%"
                            : `${Math.min(
                                (scrapeProgress.current / Math.max(scrapeProgress.total, 1)) * 100,
                                95
                              )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-tiktok-gray rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-white">Users</h2>
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

              {loading ? (
                <div className="text-center py-12 text-gray-500">
                  Loading users...
                </div>
              ) : (
                <UserTable
                  users={users}
                  selectedIds={selectedIds}
                  onSelectUser={handleSelectUser}
                  onSelectAll={handleSelectAll}
                  onRemoveUser={removeUser}
                  onSendMessage={handleSendToUser}
                  onReplyComment={handleReplyToUser}
                />
              )}
            </div>
          </div>

          <div className="space-y-6">
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
