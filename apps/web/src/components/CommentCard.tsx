import { Button } from "@/components/Button";
import { ExternalLink } from "@/components/ExternalLink";
import { getAvatarColor } from "@/utils/avatar";
import { ScrapedComment } from "@/utils/constants";
import { Check, ExternalLink as ExternalLinkIcon, Languages, Loader2, Trash2, X } from "lucide-react";
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
  translationEnabled?: boolean;
  showTranslated?: boolean;
  isTranslating?: boolean;
  onTranslate?: () => void;
  targetLanguage?: string;
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
  translationEnabled,
  showTranslated,
  isTranslating,
  onTranslate,
  targetLanguage,
}: CommentCardProps) {
  const isReply = depth > 0;
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [localShowTranslated, setLocalShowTranslated] = useState(false);
  const commentRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = commentRef.current;
    if (el) {
      setIsTruncated(el.scrollHeight > el.clientHeight);
    }
  }, [comment.comment]);

  useEffect(() => {
    if (showTranslated !== undefined) {
      setLocalShowTranslated(showTranslated);
    }
  }, [showTranslated]);

  useEffect(() => {
    if (comment.translatedText) {
      setLocalShowTranslated(true);
    }
  }, [comment.translatedText]);

  const replyStatusText = comment.replyError ? "Reply failed" : "";
  const showingTranslation = localShowTranslated && !!comment.translatedText;
  const displayText = showingTranslation ? comment.translatedText! : comment.comment;

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
            className={`flex gap-2 text-sm text-foreground-secondary mt-1 ${isCommentExpanded ? "" : ""}`}
          >
            {comment.videoUrl && (
              <ExternalLink
                href={comment.videoUrl}
                className="flex-shrink-0 text-foreground-secondary hover:text-accent-cyan-text transition-colors mt-0.5"
                title="Open on TikTok"
              >
                <ExternalLinkIcon className="w-4 h-4" />
              </ExternalLink>
            )}
            <span
              ref={commentRef}
              className={isCommentExpanded ? "" : "line-clamp-2"}
            >
              {displayText}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(isTruncated || isCommentExpanded) && (
              <button
                onClick={() => setIsCommentExpanded(!isCommentExpanded)}
                className="text-xs text-foreground-secondary hover:text-foreground underline decoration-foreground-muted transition-colors"
              >
                {isCommentExpanded ? "Show less" : "Show more"}
              </button>
            )}
            {comment.translatedText && (
              <button
                onClick={() => setLocalShowTranslated(!localShowTranslated)}
                className="text-xs text-accent-cyan-text mt-1 opacity-70 hover:opacity-100 transition-colors"
              >
                {showingTranslation ? "Show original" : "Show translation"}
              </button>
            )}
            {translationEnabled && !comment.translatedText && onTranslate && comment.source !== "app" &&
              comment.detectedLanguage && comment.detectedLanguage !== targetLanguage && (
              <button
                onClick={onTranslate}
                disabled={isTranslating}
                className="inline-flex items-center gap-1 text-xs text-accent-cyan-text mt-1 opacity-70 hover:opacity-100 transition-colors disabled:opacity-50"
              >
                {isTranslating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Languages className="w-3 h-3" />
                )}
                Translate
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0 self-center items-center">
          {comment.videoUrl && (
            <Button
              variant="soft"
              size="sm"
              onClick={onReply}
              disabled={isReplying}
              icon={isReplying ? <Loader2 className="animate-spin" /> : undefined}
            >
              {isReplying ? "Replying..." : "Reply"}
            </Button>
          )}
          {isSearchingMatches ? (
            <div className="flex items-center gap-2 px-2 py-1 border border-red-400/50 bg-red-500/10 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
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
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1 text-foreground-muted hover:bg-surface-secondary rounded transition-colors"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 text-red-400 border border-red-400/50 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
