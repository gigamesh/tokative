import { ScrapedComment } from "@/utils/constants";
import { getAvatarColor } from "@/utils/avatar";
import { CommentReplyStatus } from "@tokative/shared";
import { AlertTriangle, Check, CircleAlert, X } from "lucide-react";
import { useRef, useState } from "react";
import { Spinner } from "./Spinner";

interface CompactCommentCardProps {
  comment: ScrapedComment;
  onRemove: () => void;
  status?: CommentReplyStatus;
}

const STATUS_CONFIG: Record<Exclude<CommentReplyStatus, "pending">, {
  icon: React.ReactNode;
  tooltip: string;
}> = {
  replying: {
    icon: <Spinner size="xs" />,
    tooltip: "Replying now...",
  },
  sent: {
    icon: <Check className="w-4 h-4 text-green-400" />,
    tooltip: "Reply sent successfully",
  },
  skipped: {
    icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
    tooltip: "Skipped — comment not found on TikTok",
  },
  failed: {
    icon: <CircleAlert className="w-4 h-4 text-red-400" />,
    tooltip: "Failed to post reply",
  },
};

function StatusIndicator({ status }: { status: Exclude<CommentReplyStatus, "pending"> }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const config = STATUS_CONFIG[status];

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShowTooltip(true), 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setShowTooltip(false);
  };

  return (
    <span
      className="flex-shrink-0 flex items-center relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {config.icon}
      {showTooltip && (
        <span className="absolute right-full mr-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] text-foreground bg-surface-elevated border border-border rounded shadow-lg whitespace-nowrap z-20 pointer-events-none">
          {config.tooltip}
        </span>
      )}
    </span>
  );
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
  onRemove,
  status,
}: CompactCommentCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-surface hover:bg-surface-elevated transition-colors">
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
        {comment.translatedText ?? comment.comment}
      </span>

      {comment.commentTimestamp && (
        <span className="text-[10px] text-foreground-muted flex-shrink-0">
          {formatRelativeTime(comment.commentTimestamp)}
        </span>
      )}

      {status && status !== "pending" ? (
        <StatusIndicator status={status} />
      ) : (
        <button
          onClick={onRemove}
          className="p-0.5 text-red-400/70 hover:text-red-400 transition-colors flex-shrink-0"
          title="Remove from selection"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
