import { ExternalLink } from "@/components/ExternalLink";
import { ScrapedVideo, GetVideoCommentsProgress } from "@/utils/constants";

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
  const isLoading = progress && progress.status !== "complete" && progress.status !== "error";

  const handleClick = () => {
    if (onViewComments) {
      onViewComments();
    }
  };

  return (
    <div
      className={`group relative rounded-lg overflow-hidden ring-2 transition-colors ${
        isLoading
          ? "ring-accent-cyan-muted/30 border border-accent-cyan-muted-half"
          : selected
          ? "ring-accent-cyan-muted/30 border border-accent-cyan-muted-half"
          : "ring-transparent border border-border hover:border-foreground-muted"
      }`}
    >
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="w-5 h-5 rounded border-border bg-surface-secondary/80 text-accent-cyan-solid focus:ring-accent-cyan-solid cursor-pointer"
        />
      </div>

      <ExternalLink
        href={video.videoUrl}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 z-10 p-1.5 bg-black/60 hover:bg-black/80 rounded-md transition-colors"
        title="Open on TikTok"
      >
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </ExternalLink>

      {commentCount > 0 && (
        <div className="absolute bottom-2 right-2 z-10 bg-accent-cyan-solid text-white text-xs px-2 py-1 rounded-full font-medium">
          {commentCount}
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
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
              <p className="text-white text-xs">{progress?.message || "Loading..."}</p>
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
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
