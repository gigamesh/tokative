import { Button } from "@/components/Button";
import { ExternalLink } from "@/components/ExternalLink";
import { getAvatarColor } from "@/utils/avatar";
import { ScrapedComment } from "@/utils/constants";
import { useEffect, useRef, useState } from "react";

interface CommentCardProps {
  comment: ScrapedComment;
  selected: boolean;
  onSelect: (selected: boolean, shiftKey: boolean) => void;
  onRemove: () => void;
  onReply: () => void;
  thumbnailUrl?: string;
  depth?: number;
  isReplying?: boolean;
  isSearchingMatches?: boolean;
  transparent?: boolean;
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
  isReplying = false,
  isSearchingMatches = false,
  transparent = false,
}: CommentCardProps) {
  const isReply = depth > 0;
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
          ? "border-accent-cyan-muted-half bg-accent-cyan-muted/10"
          : transparent
            ? "border-border bg-transparent hover:border-foreground-muted"
            : "border-border bg-surface-elevated hover:border-foreground-muted"
      } ${isReply ? "ml-10 border-l-2 border-l-border" : ""}`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) =>
            onSelect(
              e.target.checked,
              e.nativeEvent instanceof MouseEvent && e.nativeEvent.shiftKey,
            )
          }
          className="mt-0.5 w-4 h-4 rounded border-border bg-surface-secondary text-accent-cyan-solid focus:ring-accent-cyan-solid"
        />

        {thumbnailUrl && !isReply && (
          <ExternalLink href={comment.videoUrl} className="flex-shrink-0">
            <img
              src={thumbnailUrl}
              alt="Video thumbnail"
              className="w-10 h-12 object-cover rounded bg-surface-secondary"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </ExternalLink>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isReply && (
              <span className="text-foreground-muted text-sm">↳</span>
            )}
            <ExternalLink href={comment.profileUrl} className="flex-shrink-0">
              {comment.avatarUrl && !avatarFailed ? (
                <img
                  src={comment.avatarUrl}
                  alt={`@${comment.handle}`}
                  className="w-6 h-6 rounded-full object-cover bg-surface-secondary"
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
            </ExternalLink>
            <ExternalLink
              href={comment.profileUrl}
              className="font-medium text-sm text-foreground hover:text-accent-cyan-text transition-colors"
            >
              @{comment.handle}
            </ExternalLink>
            {comment.commentTimestamp && (
              <span className="text-xs text-foreground-muted">
                {formatRelativeTime(comment.commentTimestamp)}
              </span>
            )}
            {replyStatusText && (
              <span className="text-xs text-red-400">{replyStatusText}</span>
            )}
            {!isReply &&
              comment.replyCount != null &&
              comment.replyCount > 0 && (
                <span className="text-xs text-foreground-muted">
                  {comment.replyCount}{" "}
                  {comment.replyCount === 1 ? "reply" : "replies"}
                </span>
              )}
          </div>

          <div
            className={`flex gap-2 text-sm text-foreground-muted mt-1 ${isCommentExpanded ? "" : ""}`}
          >
            {comment.videoUrl && (
              <ExternalLink
                href={comment.videoUrl}
                className="flex-shrink-0 text-foreground-secondary hover:text-accent-cyan-text transition-colors mt-0.5"
                title="Open on TikTok"
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </ExternalLink>
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
              className="text-xs text-foreground-secondary hover:text-foreground underline decoration-foreground-muted transition-colors"
            >
              {isCommentExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0 self-center items-center">
          {comment.videoUrl && (
            <Button
              variant="soft"
              size="sm"
              onClick={onReply}
              disabled={isReplying}
              icon={
                isReplying ? (
                  <svg className="animate-spin" fill="none" viewBox="0 0 24 24">
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
                ) : undefined
              }
            >
              {isReplying ? "Replying..." : "Reply"}
            </Button>
          )}
          {isSearchingMatches ? (
            <div className="flex items-center gap-2 px-2 py-1 border border-red-400/50 bg-red-500/10 rounded-lg">
              <svg
                className="w-4 h-4 animate-spin text-red-400"
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
              <span className="text-xs text-red-400">Searching...</span>
            </div>
          ) : showDeleteConfirm ? (
            <div className="flex items-center gap-1.5 px-2 py-1 border border-red-400/50 bg-red-500/10 rounded-lg">
              <span className="text-xs text-red-400 whitespace-nowrap">
                Are you sure?
              </span>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onRemove();
                }}
                className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                title="Confirm delete"
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1 text-foreground-muted hover:bg-surface-secondary rounded transition-colors"
                title="Cancel"
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
