
import { ScrapedComment } from "@/utils/constants";
import { getAvatarColor } from "@/utils/avatar";
import { useEffect, useRef, useState } from "react";

interface CommentCardProps {
  comment: ScrapedComment;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onRemove: () => void;
  onReply: () => void;
  thumbnailUrl?: string;
  depth?: number;
  hasAppReply?: boolean;
  isReplying?: boolean;
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
  onRemove,
  onReply,
  thumbnailUrl,
  depth = 0,
  hasAppReply = false,
  isReplying = false,
}: CommentCardProps) {
  const isReply = depth > 0;
  const isAppPosted = comment.source === "app";
  const hasAppHighlight = isAppPosted || hasAppReply;
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const commentRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = commentRef.current;
    if (el) {
      setIsTruncated(el.scrollHeight > el.clientHeight);
    }
  }, [comment.comment]);

  const replyStatusText = comment.replyError ? "Reply failed" : "";

  return (
    <div
      className={`px-3 py-2 rounded-lg border transition-colors ${
        selected
          ? "border-blue-500 bg-blue-500/10"
          : hasAppHighlight
            ? "border-yellow-500/40 bg-tiktok-gray hover:border-yellow-500/60"
            : "border-gray-700 bg-tiktok-gray hover:border-gray-600"
      } ${isReply ? `ml-10 border-l-2 ${hasAppHighlight && !selected ? "border-l-yellow-500/40 hover:border-l-yellow-500/60" : "border-l-gray-600"}` : ""}`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
        />

        {thumbnailUrl && !isReply && (
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
            {isReply && <span className="text-gray-500 text-sm">↳</span>}
            <a href={comment.profileUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
              {comment.avatarUrl && !avatarFailed ? (
                <img
                  src={comment.avatarUrl}
                  alt={`@${comment.handle}`}
                  className="w-6 h-6 rounded-full object-cover bg-gray-700"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                  style={{ backgroundColor: getAvatarColor(comment.handle) }}
                >
                  {comment.handle.charAt(0).toUpperCase()}
                </div>
              )}
            </a>
            <a
              href={comment.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm text-white hover:text-blue-400 transition-colors"
            >
              @{comment.handle}
            </a>
            {comment.commentTimestamp && (
              <span className="text-xs text-gray-500">
                {formatRelativeTime(comment.commentTimestamp)}
              </span>
            )}
            {replyStatusText && (
              <span className="text-xs text-red-400">{replyStatusText}</span>
            )}
            {!isReply && comment.replyCount != null && comment.replyCount > 0 && (
              <span className="text-xs text-gray-500">
                {comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}
              </span>
            )}
          </div>

          <div className={`flex gap-1.5 text-sm text-gray-400 ${isCommentExpanded ? "" : ""}`}>
            {comment.videoUrl && (
              <a
                href={comment.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-gray-500 hover:text-blue-400 transition-colors mt-0.5"
                title="Open on TikTok"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            <span
              ref={commentRef}
              className={isCommentExpanded ? "" : "line-clamp-2"}
            >
              {comment.comment}
            </span>
          </div>
          {(isTruncated || isCommentExpanded) && (
            <button
              onClick={() => setIsCommentExpanded(!isCommentExpanded)}
              className="text-xs text-blue-400 hover:underline"
            >
              {isCommentExpanded ? "Show less" : "Show more"}
            </button>
          )}

        </div>

        <div className="flex gap-2 flex-shrink-0 self-center items-center">
          {comment.videoUrl && (
            <button
              onClick={onReply}
              disabled={isReplying}
              className={`px-3 py-1.5 text-sm border rounded-lg transition-colors flex items-center gap-2 ${
                isReplying
                  ? "text-blue-400/60 border-blue-400/30 bg-blue-500/5 cursor-not-allowed"
                  : "text-blue-400 border-blue-400/50 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-400"
              }`}
            >
              {isReplying && (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {isReplying ? "Replying..." : "Reply"}
            </button>
          )}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1.5 px-2 py-1 border border-red-400/50 bg-red-500/10 rounded-lg">
              <span className="text-xs text-red-400 whitespace-nowrap">Are you sure?</span>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onRemove();
                }}
                className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                title="Confirm delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1 text-gray-400 hover:bg-gray-500/20 rounded transition-colors"
                title="Cancel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-red-400 border border-red-400/50 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400 rounded-lg transition-colors"
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
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
