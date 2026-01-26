
import { ScrapedComment } from "@/utils/constants";
import { useEffect, useRef, useState } from "react";

interface CommentCardProps {
  comment: ScrapedComment;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onRemove: () => void;
  onReply: () => void;
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
  onRemove,
  onReply,
  thumbnailUrl,
}: CommentCardProps) {
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const commentRef = useRef<HTMLAnchorElement>(null);

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
          ? "border-blue-500 bg-blue-500/10"
          : "border-gray-700 bg-tiktok-gray hover:border-gray-600"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
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

          <a
            ref={commentRef}
            href={comment.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`block text-sm text-gray-400 ${isCommentExpanded ? "" : "line-clamp-2"}`}
          >
            {comment.comment}
          </a>
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

        <div className="flex gap-2 flex-shrink-0 self-center">
          {!comment.replySent && comment.videoUrl && (
            <button
              onClick={onReply}
              className="px-3 py-1.5 text-sm text-blue-400 border border-blue-400/50 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-400 rounded-lg transition-colors"
            >
              Reply
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
