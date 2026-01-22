"use client";

import { useState, useCallback, useRef, forwardRef } from "react";
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
  commentCountsByVideo: Map<string, number>;
  onGetComments: (videoIds: string[]) => void;
  onRemoveVideos: (videoIds: string[]) => void;
  onViewPostComments?: (videoId: string) => void;
}

export function PostsGrid({
  videos,
  loading,
  getCommentsProgress,
  commentCountsByVideo,
  onGetComments,
  onRemoveVideos,
  onViewPostComments,
}: PostsGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIndexRef = useRef<number | null>(null);

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
    onGetComments(Array.from(selectedIds));
  }, [selectedIds, onGetComments]);

  return (
    <div className="bg-tiktok-gray rounded-lg p-4">
      <h2 className="text-lg font-medium text-white mb-3">Posts</h2>

      {videos.length > 0 && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-3">
            <button
              onClick={handleRemoveSelected}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 border border-gray-600 hover:text-red-400 hover:border-red-400/50 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:hover:border-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </button>
            <button
              onClick={handleGetCommentsSelected}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 border border-gray-600 hover:text-tiktok-red hover:border-tiktok-red/50 hover:bg-tiktok-red/10 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:hover:border-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Fetch Comments
            </button>
          </div>
        </div>
      )}

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
              commentCount={commentCountsByVideo.get(video.videoId) ?? 0}
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
