import { ExternalLink } from "@/components/ExternalLink";
import { getAvatarColor } from "@/utils/avatar";
import { ScrapedComment } from "@/utils/constants";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { CommentCard } from "./CommentCard";
import { CommenterData } from "@/hooks/useCommenterData";

interface CommenterCardProps {
  commenter: CommenterData;
  expanded: boolean;
  onToggleExpand: () => void;
  selectedCommentIds: Set<string>;
  onSelectComment: (commentId: string, selected: boolean) => void;
  onRemoveComment: (commentId: string) => void;
  onReplyComment: (comment: ScrapedComment) => void;
  videoThumbnails: Map<string, string>;
  replyingCommentId?: string | null;
  searchingMatchesCommentId?: string | null;
  translationEnabled?: boolean;
  translatingIds?: Set<string>;
  onTranslateComment?: (commentId: string) => void;
  targetLanguage?: string;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function CommenterCard({
  commenter,
  expanded,
  onToggleExpand,
  selectedCommentIds,
  onSelectComment,
  onRemoveComment,
  onReplyComment,
  videoThumbnails,
  replyingCommentId,
  searchingMatchesCommentId,
  translationEnabled,
  translatingIds,
  onTranslateComment,
  targetLanguage,
}: CommenterCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  const mostRecentComment = commenter.comments[0];
  const selectedCount = commenter.comments.filter((c) =>
    selectedCommentIds.has(c.id)
  ).length;
  const allSelected = commenter.comments.length > 0 && selectedCount === commenter.comments.length;
  const someSelected = selectedCount > 0 && selectedCount < commenter.comments.length;

  const handleSelectAll = (checked: boolean) => {
    for (const comment of commenter.comments) {
      onSelectComment(comment.id, checked);
    }
  };

  const handleHeaderClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('a') ||
      target.closest('input') ||
      target.closest('button')
    ) {
      return;
    }
    onToggleExpand();
  };

  return (
    <div
      className={`rounded-lg border transition-colors ${
        someSelected || allSelected
          ? "border-accent-cyan-muted-half bg-accent-cyan-muted/5"
          : "border-border bg-surface-elevated"
      }`}
    >
      <div
        className="px-3 py-2 cursor-pointer hover:bg-surface-secondary/30 transition-colors rounded-t-lg"
        onClick={handleHeaderClick}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="mt-2 w-4 h-4 rounded border-border bg-surface-secondary text-accent-cyan-solid focus:ring-accent-cyan-solid"
            title={`Select all ${commenter.commentCount} comments from this commenter`}
          />

          <ExternalLink href={commenter.profileUrl} className="flex-shrink-0">
            {commenter.avatarUrl && !avatarFailed ? (
              <img
                src={commenter.avatarUrl}
                alt={`@${commenter.handle}`}
                className="w-10 h-10 rounded-full object-cover bg-surface-secondary"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-base font-medium text-white"
                style={{ backgroundColor: getAvatarColor(commenter.handle) }}
              >
                {commenter.handle.charAt(0).toUpperCase()}
              </div>
            )}
          </ExternalLink>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <ExternalLink
                href={commenter.profileUrl}
                className="font-medium text-sm text-foreground hover:text-accent-cyan-text transition-colors"
              >
                @{commenter.handle}
              </ExternalLink>
              <span className="px-2 py-0.5 bg-accent-cyan-muted/20 text-accent-cyan-text text-xs rounded-full">
                {commenter.commentCount} comment{commenter.commentCount !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-foreground-muted">
                Last: {formatRelativeTime(commenter.mostRecentCommentAt)}
              </span>
            </div>

            {!expanded && mostRecentComment && (
              <p className="text-sm text-foreground-muted mt-1 line-clamp-1">
                {mostRecentComment.comment}
              </p>
            )}
          </div>

          <button
            onClick={onToggleExpand}
            className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-secondary rounded-lg transition-colors flex-shrink-0"
            title={expanded ? "Collapse" : "Expand"}
          >
            <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2 max-h-96 overflow-y-auto bg-surface-secondary rounded-b-lg">
          {commenter.comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              selected={selectedCommentIds.has(comment.id)}
              onSelect={(selected) => onSelectComment(comment.id, selected)}
              onRemove={() => onRemoveComment(comment.id)}
              onReply={() => onReplyComment(comment)}
              thumbnailUrl={comment.videoId ? videoThumbnails.get(comment.videoId) : undefined}
              isReplying={replyingCommentId === comment.id}
              isSearchingMatches={searchingMatchesCommentId === comment.id}
              transparent
              translationEnabled={translationEnabled}
              isTranslating={translatingIds?.has(comment.id)}
              onTranslate={onTranslateComment ? () => onTranslateComment(comment.id) : undefined}
              targetLanguage={targetLanguage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
