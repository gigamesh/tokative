import { ScrapedComment } from "@/utils/constants";
import { getAvatarColor } from "@/utils/avatar";
import { useState } from "react";

interface CompactCommentCardProps {
  comment: ScrapedComment;
  selected: boolean;
  onToggle: (selected: boolean) => void;
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

export function CompactCommentCard({
  comment,
  selected,
  onToggle,
}: CompactCommentCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-surface hover:bg-surface-elevated transition-colors">
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-4 h-4 rounded border-border bg-surface-secondary text-blue-500 focus:ring-blue-500 flex-shrink-0"
      />

      {comment.avatarUrl && !avatarFailed ? (
        <img
          src={comment.avatarUrl}
          alt={`@${comment.handle}`}
          className="w-5 h-5 rounded-full object-cover bg-surface-secondary flex-shrink-0"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white flex-shrink-0"
          style={{ backgroundColor: getAvatarColor(comment.handle) }}
        >
          {comment.handle.charAt(0).toUpperCase()}
        </div>
      )}

      <span className="text-xs text-foreground-muted truncate flex-1 min-w-0">
        {comment.comment}
      </span>

      {comment.commentTimestamp && (
        <span className="text-[10px] text-foreground-muted flex-shrink-0">
          {formatRelativeTime(comment.commentTimestamp)}
        </span>
      )}
    </div>
  );
}
