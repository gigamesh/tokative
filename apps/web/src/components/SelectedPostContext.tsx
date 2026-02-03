
import { ScrapedVideo } from "@/utils/constants";

interface SelectedPostContextProps {
  video: ScrapedVideo;
  commentCount: number;
  onShowAllComments: () => void;
}

export function SelectedPostContext({
  video,
  commentCount,
  onShowAllComments,
}: SelectedPostContextProps) {
  return (
    <div className="flex items-center gap-4 p-3 bg-surface-secondary/50 rounded-lg border border-border">
      <a
        href={video.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 w-12 h-[72px] rounded overflow-hidden bg-surface-secondary"
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={`Post ${video.videoId}`}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-foreground-muted">
            <svg
              className="w-6 h-6"
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
          </div>
        )}
      </a>

      <div className="flex-1 min-w-0">
        <a
          href={`https://tiktok.com/@${video.profileHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          Post by @{video.profileHandle}
        </a>
        <p className="text-xs text-foreground-muted mt-0.5">
          {commentCount} comment{commentCount !== 1 ? "s" : ""} shown
        </p>
      </div>

      <button
        onClick={onShowAllComments}
        className="flex-shrink-0 px-3 py-1.5 text-sm text-foreground-muted hover:text-foreground hover:bg-surface-secondary rounded-lg transition-colors"
      >
        Show All Comments
      </button>
    </div>
  );
}
