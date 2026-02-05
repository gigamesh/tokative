import { ExternalLink } from "@/components/ExternalLink";
import { ScrapedVideo } from "@/utils/constants";
import { Image } from "lucide-react";

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
      <ExternalLink
        href={video.videoUrl}
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
            <Image className="w-6 h-6" strokeWidth={1.5} />
          </div>
        )}
      </ExternalLink>

      <div className="flex-1 min-w-0">
        <ExternalLink
          href={`https://tiktok.com/@${video.profileHandle}`}
          className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          Post by @{video.profileHandle}
        </ExternalLink>
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
