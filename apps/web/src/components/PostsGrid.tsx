import { GetVideoCommentsProgress, ScrapedVideo } from "@/utils/constants";
import { forwardRef, useCallback, useRef, useState } from "react";
import { GridComponents, VirtuosoGrid } from "react-virtuoso";
import { ConfirmationModal } from "./ConfirmationModal";
import { FetchCommentsButton } from "./FetchCommentsButton";
import { PostCard } from "./PostCard";

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
  selectedVideoIds: Set<string>;
  onSelectedVideoIdsChange: (ids: Set<string>) => void;
  onGetComments: (videoIds: string[]) => void;
  onRemoveVideos: (videoIds: string[]) => void;
  onViewPostComments?: (videoId: string) => void;
  onPostSelectionChange?: (videoIds: string[], selected: boolean) => void;
  isScraping?: boolean;
  onCancelScraping?: () => void;
}

export function PostsGrid({
  videos,
  loading,
  getCommentsProgress,
  commentCountsByVideo,
  selectedVideoIds,
  onSelectedVideoIdsChange,
  onGetComments,
  onRemoveVideos,
  onViewPostComments,
  onPostSelectionChange,
  isScraping = false,
  onCancelScraping,
}: PostsGridProps) {
  const lastSelectedIndexRef = useRef<number | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const allSelected =
    videos.length > 0 && selectedVideoIds.size === videos.length;
  const someSelected =
    selectedVideoIds.size > 0 && selectedVideoIds.size < videos.length;

  const handleSelectVideo = useCallback(
    (videoId: string, selected: boolean, index: number, shiftKey: boolean) => {
      let affectedVideoIds: string[] = [];

      if (shiftKey && lastSelectedIndexRef.current !== null) {
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        affectedVideoIds = videos.slice(start, end + 1).map((v) => v.videoId);
      } else {
        affectedVideoIds = [videoId];
      }

      const next = new Set(selectedVideoIds);
      for (const id of affectedVideoIds) {
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      lastSelectedIndexRef.current = index;
      onSelectedVideoIdsChange(next);

      onPostSelectionChange?.(affectedVideoIds, selected);
    },
    [videos, selectedVideoIds, onSelectedVideoIdsChange, onPostSelectionChange],
  );

  const handleSelectAll = useCallback(() => {
    const allVideoIds = videos.map((v) => v.videoId);
    if (allSelected) {
      onSelectedVideoIdsChange(new Set());
      onPostSelectionChange?.(allVideoIds, false);
    } else {
      onSelectedVideoIdsChange(new Set(allVideoIds));
      onPostSelectionChange?.(allVideoIds, true);
    }
    lastSelectedIndexRef.current = null;
  }, [allSelected, videos, onSelectedVideoIdsChange, onPostSelectionChange]);

  const handleRemoveSelected = useCallback(() => {
    if (selectedVideoIds.size === 0) return;
    setShowRemoveConfirm(true);
  }, [selectedVideoIds]);

  const confirmRemoveSelected = useCallback(() => {
    onRemoveVideos(Array.from(selectedVideoIds));
    onSelectedVideoIdsChange(new Set());
    lastSelectedIndexRef.current = null;
  }, [selectedVideoIds, onRemoveVideos, onSelectedVideoIdsChange]);

  const handleGetCommentsSelected = useCallback(() => {
    if (selectedVideoIds.size === 0) return;
    onGetComments(Array.from(selectedVideoIds));
  }, [selectedVideoIds, onGetComments]);

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
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-sm text-gray-400">
              {selectedVideoIds.size > 0
                ? `${selectedVideoIds.size} selected`
                : "Select all"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRemoveSelected}
              disabled={selectedVideoIds.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 border border-red-400/50 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-gray-400 disabled:border-gray-600 disabled:hover:bg-transparent"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Remove
            </button>
            {isScraping ? (
              <button
                onClick={onCancelScraping}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-tiktok-red hover:bg-red-600 rounded-lg transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cancel
              </button>
            ) : (
              <FetchCommentsButton
                onClick={handleGetCommentsSelected}
                disabled={selectedVideoIds.size === 0}
              />
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading posts...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mb-2">No posts scraped yet</p>
          <p className="text-sm text-gray-600">
            To scrape posts, navigate to a TikTok profile and click
            <br />
            <span className="text-tiktok-red">Scrape Profile</span> in the
            extension popup.
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
              selected={selectedVideoIds.has(video.videoId)}
              onSelect={(selected) => {
                const event = window.event as MouseEvent | undefined;
                handleSelectVideo(
                  video.videoId,
                  selected,
                  index,
                  event?.shiftKey || false,
                );
              }}
              progress={getCommentsProgress.get(video.videoId)}
              commentCount={commentCountsByVideo.get(video.videoId) ?? 0}
              onViewComments={
                onViewPostComments
                  ? () => onViewPostComments(video.videoId)
                  : undefined
              }
            />
          )}
        />
      )}

      <ConfirmationModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={confirmRemoveSelected}
        title="Remove selected posts?"
        message={`Are you sure you want to remove ${selectedVideoIds.size} selected post${selectedVideoIds.size > 1 ? "s" : ""}? This will also remove any comments associated with these posts. This action cannot be undone (your TikTok account will not be affected).`}
        confirmText="Remove"
        variant="danger"
      />
    </div>
  );
}
