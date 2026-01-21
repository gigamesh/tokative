"use client";

import { ScrapedVideo, GetVideoCommentsProgress } from "@/utils/constants";

interface PostCardProps {
  video: ScrapedVideo;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  progress?: GetVideoCommentsProgress;
}

export function PostCard({
  video,
  selected,
  onSelect,
  progress,
}: PostCardProps) {
  const isLoading = progress && progress.status !== "complete" && progress.status !== "error";

  return (
    <div
      className={`relative rounded-lg overflow-hidden border transition-colors ${
        selected
          ? "border-tiktok-red ring-2 ring-tiktok-red/30"
          : "border-gray-700 hover:border-gray-600"
      }`}
    >
      <div className="absolute top-2 left-2 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="w-5 h-5 rounded border-gray-600 bg-gray-800/80 text-tiktok-red focus:ring-tiktok-red cursor-pointer"
        />
      </div>

      {video.commentsScraped && (
        <div className="absolute top-2 right-2 z-10 bg-green-500/90 text-white text-xs px-2 py-1 rounded-full font-medium">
          {video.commentCount ?? 0} comments
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-tiktok-red border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-white text-xs">{progress?.message || "Loading..."}</p>
          </div>
        </div>
      )}

      <a
        href={video.videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-[9/16] bg-gray-800"
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
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </a>
    </div>
  );
}
