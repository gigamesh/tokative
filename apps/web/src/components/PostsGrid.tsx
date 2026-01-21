"use client";

import { useState, useCallback, useRef, useEffect, forwardRef } from "react";
import { VirtuosoGrid, GridComponents } from "react-virtuoso";
import { PostCard } from "./PostCard";
import { ScrapedVideo, GetVideoCommentsProgress } from "@/utils/constants";

const gridComponents: GridComponents<ScrapedVideo> = {
  List: forwardRef(({ style, children, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: "0.75rem",
      }}
    >
      {children}
    </div>
  )),
  Item: ({ children, ...props }) => <div {...props}>{children}</div>,
};

interface PostsGridProps {
  videos: ScrapedVideo[];
  loading: boolean;
  getCommentsProgress: Map<string, GetVideoCommentsProgress>;
  postLimit: number;
  onPostLimitChange: (limit: number) => void;
  onGetComments: (videoIds: string[]) => void;
  onRemoveVideos: (videoIds: string[]) => void;
  onViewPostComments?: (videoId: string) => void;
}

export function PostsGrid({
  videos,
  loading,
  getCommentsProgress,
  postLimit,
  onPostLimitChange,
  onGetComments,
  onRemoveVideos,
  onViewPostComments,
}: PostsGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [postLimitInput, setPostLimitInput] = useState<string>(String(postLimit));
  const lastSelectedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    setPostLimitInput(String(postLimit));
  }, [postLimit]);

  const allSelected = videos.length > 0 && selectedIds.size === videos.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < videos.length;

  const handleSelectVideo = useCallback(
    (videoId: string, selected: boolean, index: number, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastSelectedIndexRef.current !== null) {
          const start = Math.min(lastSelectedIndexRef.current, index);
          const end = Math.max(lastSelectedIndexRef.current, index);
          for (let i = start; i <= end; i++) {
            if (selected) {
              next.add(videos[i].videoId);
            } else {
              next.delete(videos[i].videoId);
            }
          }
        } else {
          if (selected) {
            next.add(videoId);
          } else {
            next.delete(videoId);
          }
        }

        lastSelectedIndexRef.current = index;
        return next;
      });
    },
    [videos]
  );

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(videos.map((v) => v.videoId)));
    }
    lastSelectedIndexRef.current = null;
  }, [allSelected, videos]);

  const handleRemoveSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    onRemoveVideos(Array.from(selectedIds));
    setSelectedIds(new Set());
    lastSelectedIndexRef.current = null;
  }, [selectedIds, onRemoveVideos]);

  const handleGetCommentsSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const videosToScrape = videos
      .filter((v) => selectedIds.has(v.videoId) && !v.commentsScraped)
      .map((v) => v.videoId);
    if (videosToScrape.length > 0) {
      onGetComments(videosToScrape);
    }
  }, [selectedIds, videos, onGetComments]);

  const selectedNotScrapedCount = videos.filter(
    (v) => selectedIds.has(v.videoId) && !v.commentsScraped
  ).length;

  const handlePostLimitBlur = useCallback(() => {
    const parsed = parseInt(postLimitInput);
    const value = isNaN(parsed) || parsed < 1 ? 50 : parsed;
    setPostLimitInput(String(value));
    onPostLimitChange(value);
  }, [postLimitInput, onPostLimitChange]);

  return (
    <div className="bg-tiktok-gray rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-white">Posts</h2>

        <div className="flex items-center gap-2">
          {videos.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-tiktok-red focus:ring-tiktok-red cursor-pointer"
              />
              <span className="text-sm text-gray-400">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
              </span>
            </div>
          )}

          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleRemoveSelected}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Remove selected posts"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {selectedNotScrapedCount > 0 && (
                <button
                  onClick={handleGetCommentsSelected}
                  className="p-2 text-gray-400 hover:text-tiktok-red hover:bg-tiktok-red/10 rounded-lg transition-colors"
                  title={`Get comments for ${selectedNotScrapedCount} post${selectedNotScrapedCount > 1 ? "s" : ""}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Post Limit</label>
          <input
            type="number"
            value={postLimitInput}
            onChange={(e) => setPostLimitInput(e.target.value)}
            onBlur={handlePostLimitBlur}
            min={1}
            className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-tiktok-red"
          />
        </div>
      </div>


      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading posts...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mb-2">No posts scraped yet</p>
          <p className="text-sm text-gray-600">
            To scrape posts, navigate to a TikTok profile and click<br />
            <span className="text-tiktok-red">Scrape Profile</span> in the extension popup.
          </p>
        </div>
      ) : (
        <VirtuosoGrid
          data={videos}
          useWindowScroll
          overscan={20}
          components={gridComponents}
          itemContent={(index, video) => (
            <PostCard
              video={video}
              selected={selectedIds.has(video.videoId)}
              onSelect={(selected) => {
                const event = window.event as MouseEvent | undefined;
                handleSelectVideo(video.videoId, selected, index, event?.shiftKey || false);
              }}
              progress={getCommentsProgress.get(video.videoId)}
              onViewComments={
                onViewPostComments ? () => onViewPostComments(video.videoId) : undefined
              }
            />
          )}
        />
      )}
    </div>
  );
}
