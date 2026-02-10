import { GetVideoCommentsProgress, ScrapedVideo } from "@/utils/constants";
import { Image, X } from "lucide-react";
import { forwardRef, useCallback, useRef, useState } from "react";
import { GridComponents, VirtuosoGrid } from "react-virtuoso";
import { Button } from "./Button";
import { ConfirmationModal } from "./ConfirmationModal";
import { DangerButton } from "./DangerButton";
import { FetchCommentsButton } from "./FetchCommentsButton";
import { PostCard } from "./PostCard";
import { TabContentContainer } from "./TabContentContainer";

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
  isCancelling?: boolean;
  onCancelScraping?: () => void;
  postLimitInput: string;
  onPostLimitChange: (value: string) => void;
  onPostLimitBlur: () => void;
  commentLimitReached?: boolean;
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
  isCancelling = false,
  onCancelScraping,
  postLimitInput,
  onPostLimitChange,
  onPostLimitBlur,
  commentLimitReached = false,
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

  const stickyHeader = (
    <>
      <div className="flex items-center gap-4 mb-3">
        <h2 className="text-lg font-medium text-foreground">Posts</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-foreground-muted">Post Limit</label>
          <input
            type="number"
            value={postLimitInput}
            onChange={(e) => onPostLimitChange(e.target.value)}
            onBlur={onPostLimitBlur}
            min={1}
            className="w-20 px-2 py-1 bg-surface-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-accent-cyan-muted"
          />
        </div>
      </div>

      {videos.length > 0 && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={handleSelectAll}
            className="w-4 h-4 rounded border-border bg-surface-secondary text-accent-cyan-solid focus:ring-accent-cyan-solid cursor-pointer"
          />
          <span className="text-sm text-foreground-muted">
            {selectedVideoIds.size > 0
              ? `${selectedVideoIds.size} selected`
              : "Select all"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <DangerButton
            onClick={handleRemoveSelected}
            disabled={selectedVideoIds.size === 0}
          >
            Remove
          </DangerButton>
          {isScraping ? (
            isCancelling ? (
              <Button
                variant="outline"
                size="sm"
                disabled
              >
                Cancelling...
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={onCancelScraping}
                icon={<X />}
              >
                Cancel
              </Button>
            )
          ) : (
            <span title={commentLimitReached ? "Monthly comment limit reached" : undefined}>
              <FetchCommentsButton
                onClick={handleGetCommentsSelected}
                disabled={selectedVideoIds.size === 0 || commentLimitReached}
              />
            </span>
          )}
        </div>
        </div>
      )}
    </>
  );

  return (
    <TabContentContainer stickyHeader={stickyHeader}>

      {loading ? (
        <div className="text-center py-12 text-foreground-muted">Loading posts...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-foreground-muted">
          <Image className="w-16 h-16 mx-auto mb-4 text-foreground-muted" strokeWidth={1.5} />
          <p className="mb-2">No posts collected yet</p>
          <p className="text-sm text-foreground-muted">
            To collect posts, navigate to a TikTok profile and click
            <br />
            <span className="font-semibold text-foreground-secondary">
              Collect Profile
            </span>{" "}
            in the extension popup.
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
    </TabContentContainer>
  );
}
