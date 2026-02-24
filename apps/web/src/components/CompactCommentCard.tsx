import { ExternalLink } from "@/components/ExternalLink";
import { getAvatarColor } from "@/utils/avatar";
import { ScrapedComment } from "@/utils/constants";
import { CommentReplyStatus } from "@tokative/shared";
import { AlertTriangle, Check, CircleAlert, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "./Spinner";

interface CompactCommentCardProps {
  comment: ScrapedComment;
  onRemove: () => void;
  isRemoving?: boolean;
  status?: CommentReplyStatus;
  displayText?: string;
}

const STATUS_CONFIG: Record<
  Exclude<CommentReplyStatus, "pending">,
  {
    icon: React.ReactNode;
    tooltip: string;
  }
> = {
  replying: {
    icon: <Spinner size="xs" />,
    tooltip: "Replying now...",
  },
  sent: {
    icon: <Check className="w-4 h-4 text-green-400" />,
    tooltip: "Reply sent successfully",
  },
  commentNotFound: {
    icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
    tooltip:
      "Skipped — comment was not found on the video. It may have been deleted.",
  },
  detectionFailed: {
    icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
    tooltip:
      "Reply was sent but could not be verified. It may not appear in your comments.",
  },
  mentionFailed: {
    icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    tooltip:
      "Skipped — could not @mention this user, likely because they have privacy controls enabled.",
  },
  failed: {
    icon: <CircleAlert className="w-4 h-4 text-red-400" />,
    tooltip: "Failed to post reply",
  },
};

function StatusIndicator({
  status,
}: {
  status: Exclude<CommentReplyStatus, "pending">;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const iconRef = useRef<HTMLSpanElement>(null);
  const config = STATUS_CONFIG[status];

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (iconRef.current) {
        const rect = iconRef.current.getBoundingClientRect();
        setTooltipPos({
          top: rect.top + rect.height / 2,
          right: window.innerWidth - rect.left + 6,
        });
      }
      setShowTooltip(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setShowTooltip(false);
  };

  return (
    <span
      ref={iconRef}
      className="flex-shrink-0 flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {config.icon}
      {showTooltip &&
        tooltipPos &&
        createPortal(
          <span
            className="fixed -translate-y-1/2 px-2 py-1 text-[11px] text-foreground bg-surface-elevated border border-border rounded shadow-lg z-50 pointer-events-none max-w-[11rem]"
            style={{ top: tooltipPos.top, right: tooltipPos.right }}
          >
            {config.tooltip}
          </span>,
          document.body,
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
  isRemoving,
  status,
  displayText,
}: CompactCommentCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <ExternalLink href={comment.profileUrl} className="flex-shrink-0">
        {comment.avatarUrl && !avatarFailed ? (
          <img
            src={comment.avatarUrl}
            alt={`@${comment.handle}`}
            className="w-5 h-5 rounded-full object-cover bg-surface-secondary"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
            style={{ backgroundColor: getAvatarColor(comment.handle) }}
          >
            {comment.handle.charAt(0).toUpperCase()}
          </div>
        )}
      </ExternalLink>

      <span className="text-xs text-foreground-muted truncate flex-1 min-w-0">
        {displayText ?? comment.translatedText ?? comment.comment}
      </span>

      {comment.commentTimestamp && (
        <span className="text-[10px] text-foreground-muted flex-shrink-0">
          {formatRelativeTime(comment.commentTimestamp)}
        </span>
      )}

      {status && status !== "pending" && (
        <StatusIndicator status={status} />
      )}
      {isRemoving ? (
        <Loader2 className="w-4 h-4 animate-spin text-foreground-muted flex-shrink-0" />
      ) : (
        <button
          onClick={onRemove}
          disabled={status === "replying"}
          className="p-0.5 text-red-400/70 hover:text-red-400 transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-red-400/70"
          title="Remove from queue"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
