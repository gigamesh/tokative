import { ExternalLink } from "@/components/ExternalLink";
import { GetVideoCommentsProgress, ScrapedVideo } from "@/utils/constants";
import { ExternalLink as ExternalLinkIcon, Image } from "lucide-react";

interface PostCardProps {
  video: ScrapedVideo;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  progress?: GetVideoCommentsProgress;
  commentCount?: number;
  onViewComments?: () => void;
}

export function PostCard({
  video,
  selected,
  onSelect,
  progress,
  commentCount = 0,
  onViewComments,
}: PostCardProps) {
  const isLoading =
    progress && progress.status !== "complete" && progress.status !== "error";
  const isLocked =
    progress?.status === "scraping" || progress?.status === "complete";

  const handleClick = () => {
    if (onViewComments) {
      onViewComments();
    }
  };

  return (
    <div
      className={`group relative rounded-lg overflow-hidden ring-2 transition-colors ${
        isLoading
          ? "ring-accent-cyan-muted-30 border border-accent-cyan-muted-half"
          : selected
            ? "ring-accent-cyan-muted-30 border border-accent-cyan-muted-half"
            : "ring-transparent border border-border hover:border-foreground-muted"
      }`}
    >
      <div className="absolute top-2 left-2 z-30">
        <input
          type="checkbox"
          checked={selected}
          disabled={isLocked}
          onChange={(e) => onSelect(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className={`w-5 h-5 rounded border-border bg-surface-secondary/80 text-accent-cyan-solid focus:ring-accent-cyan-solid ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        />
      </div>

      <ExternalLink
        href={video.videoUrl}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 z-30 p-1.5 bg-black/80 hover:bg-black/80 rounded-md transition-colors"
        title="Open on TikTok"
      >
        <ExternalLinkIcon className="w-3.5 h-3.5 text-white" />
      </ExternalLink>

      {commentCount > 0 && (
        <div className="absolute bottom-2 right-2 z-30 bg-accent-cyan-solid text-white text-xs px-2 py-1 rounded-full font-medium">
          {commentCount}
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <div className="text-center px-2">
            <div className="w-8 h-8 border-2 border-accent-cyan-muted border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            {progress?.stats ? (
              <div className="text-white text-xs space-y-0.5">
                <p>Found: {progress.stats.found}</p>
                <p>New: {progress.stats.new}</p>
                <p>Preexisting: {progress.stats.preexisting}</p>
                <p>Ignored: {progress.stats.ignored}</p>
              </div>
            ) : (
              <p className="text-white text-xs">
                {progress?.message || "Loading..."}
              </p>
            )}
          </div>
        </div>
      )}

      <div
        onClick={handleClick}
        className={`block aspect-[9/16] bg-surface-secondary ${
          onViewComments ? "cursor-pointer" : ""
        }`}
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={`Post ${video.videoId}`}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-foreground-muted">
            <Image className="w-12 h-12" strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  );
}
