"use client";

import { ScrapedComment } from "@/utils/constants";
import { useEffect, useRef, useState } from "react";

interface CommentCardProps {
  comment: ScrapedComment;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  thumbnailUrl?: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function CommentCard({
  comment,
  selected,
  onSelect,
  thumbnailUrl,
}: CommentCardProps) {
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const commentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = commentRef.current;
    if (el) {
      setIsTruncated(el.scrollHeight > el.clientHeight);
    }
  }, [comment.comment]);

  const replyStatusColor = comment.replySent
    ? "text-green-400"
    : comment.replyError
      ? "text-red-400"
      : "text-gray-400";

  const replyStatusText = comment.replySent
    ? "Replied"
    : comment.replyError
      ? "Reply failed"
      : "";

  return (
    <div
      className={`px-3 py-2 rounded-lg border transition-colors ${
        selected
          ? "border-tiktok-red bg-tiktok-red/10"
          : "border-gray-700 bg-tiktok-gray hover:border-gray-600"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-tiktok-red focus:ring-tiktok-red"
        />

        {thumbnailUrl && (
          <a
            href={comment.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <img
              src={thumbnailUrl}
              alt="Video thumbnail"
              className="w-10 h-12 object-cover rounded bg-gray-800"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </a>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={comment.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm text-white hover:text-tiktok-red transition-colors"
            >
              @{comment.handle}
            </a>
            {comment.commentTimestamp && (
              <span className="text-xs text-gray-500">
                {formatRelativeTime(comment.commentTimestamp)}
              </span>
            )}
            {replyStatusText && (
              <span className={`text-xs ${replyStatusColor}`}>
                {replyStatusText}
              </span>
            )}
          </div>

          <p
            ref={commentRef}
            className={`text-sm text-gray-400 ${isCommentExpanded ? "" : "line-clamp-2"}`}
          >
            {comment.comment}
          </p>
          {(isTruncated || isCommentExpanded) && (
            <button
              onClick={() => setIsCommentExpanded(!isCommentExpanded)}
              className="text-xs text-blue-400 hover:underline"
            >
              {isCommentExpanded ? "Show less" : "Show more"}
            </button>
          )}

          {comment.repliedAt && (
            <span className="text-xs text-gray-500">
              Replied {formatRelativeTime(comment.repliedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
