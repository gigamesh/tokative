import { ScrapedComment } from "@/utils/constants";
import { BulkReplyProgress, CommentReplyStatus } from "@tokative/shared";
import { ListX, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "./Button";
import { CompactCommentCard } from "./CompactCommentCard";

interface QueuePanelProps {
  queuedComments: ScrapedComment[];
  onDequeue: (commentIds: string[]) => Promise<void>;
  onClearQueue: () => Promise<void>;
  onStartReply: () => void;
  isReplying: boolean;
  bulkReplyProgress: BulkReplyProgress | null;
  replyLimitReached: boolean;
  replyBudget: number;
}

export function QueuePanel({
  queuedComments,
  onDequeue,
  onClearQueue,
  onStartReply,
  isReplying,
  bulkReplyProgress,
  replyLimitReached,
  replyBudget,
}: QueuePanelProps) {
  const [dequeuingIds, setDequeuingIds] = useState<Set<string>>(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const isActive = bulkReplyProgress?.status === "running";
  const isFinished =
    bulkReplyProgress?.status === "complete" ||
    bulkReplyProgress?.status === "stopped";
  const actionableCount = queuedComments.filter(
    (c) => !c.repliedTo && !c.replyErrorCode,
  ).length;

  const handleClear = useCallback(async () => {
    setIsClearing(true);
    try {
      await onClearQueue();
    } finally {
      setIsClearing(false);
    }
  }, [onClearQueue]);

  const handleRemove = useCallback(
    async (commentId: string) => {
      setDequeuingIds((prev) => new Set(prev).add(commentId));
      try {
        await onDequeue([commentId]);
      } finally {
        setDequeuingIds((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      }
    },
    [onDequeue],
  );

  return (
    <div className="bg-surface-elevated rounded-lg p-4 space-y-3 min-w-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground">Reply Queue</h3>
          {queuedComments.length > 0 && (
            <span className="text-sm bg-accent-cyan-muted-20 text-accent-cyan-text px-2 py-0.5 rounded-full">
              {queuedComments.length}
            </span>
          )}
        </div>
        {queuedComments.length > 0 && !isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isClearing}
            icon={isClearing ? <Loader2 className="animate-spin" /> : <ListX />}
            className="text-xs"
          >
            Clear All
          </Button>
        )}
      </div>

      {queuedComments.length === 0 && !isFinished && (
        <div className="border border-dashed border-border rounded-lg py-8 px-4 text-center">
          <p className="text-sm text-foreground-muted text-balance px-8">
            Select comments, write reply messages, then click Add To Queue
          </p>
        </div>
      )}

      {queuedComments.length > 0 && (
        <div className="max-h-80 overflow-y-auto space-y-1 pr-1 scrollbar-visible">
          {queuedComments.map((comment) => (
            <QueuedCommentItem
              key={comment.id}
              comment={comment}
              onRemove={() => handleRemove(comment.id)}
              isRemoving={dequeuingIds.has(comment.id)}
              status={bulkReplyProgress?.commentStatuses?.[comment.id]}
            />
          ))}
        </div>
      )}

      {!isActive && queuedComments.length > 0 && (
        <Button
          variant="primary"
          fullWidth
          onClick={onStartReply}
          disabled={actionableCount === 0 || replyLimitReached || isReplying}
        >
          {replyLimitReached
            ? "Reply Limit Reached"
            : actionableCount === 0
              ? "Start Replying"
              : `Start Replying (${Math.min(actionableCount, replyBudget)})`}
        </Button>
      )}
    </div>
  );
}

function TranslationToggleButton({
  active,
  label = "Show original",
  ...props
}: {
  active: boolean;
  label?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`text-[10px] select-none rounded px-1 py-0.5 transition-all ${active ? "bg-accent-cyan-500/20 text-accent-cyan-text" : "text-accent-cyan-text opacity-70 hover:opacity-100"}`}
    >
      {label}
    </button>
  );
}

function QueuedCommentItem({
  comment,
  onRemove,
  isRemoving,
  status,
}: {
  comment: ScrapedComment;
  onRemove: () => void;
  isRemoving?: boolean;
  status?: CommentReplyStatus;
}) {
  const [showOriginalComment, setShowOriginalComment] = useState(false);
  const [showTranslatedReply, setShowTranslatedReply] = useState(false);

  const hasTranslatedComment =
    !!comment.translatedText &&
    comment.translatedText.toLowerCase() !== comment.comment.toLowerCase();
  const hasTranslatedReply =
    !!comment.replyOriginalContent &&
    comment.queuedReplyText !== comment.replyOriginalContent;

  const commentDisplayText =
    hasTranslatedComment && showOriginalComment
      ? comment.comment
      : (comment.translatedText ?? comment.comment);

  const replyDisplayText =
    hasTranslatedReply && showTranslatedReply
      ? comment.queuedReplyText
      : (comment.replyOriginalContent ?? comment.queuedReplyText);

  return (
    <div className="px-2 py-1.5 rounded border border-border bg-surface">
      <CompactCommentCard
        comment={comment}
        onRemove={onRemove}
        isRemoving={isRemoving}
        status={status}
        displayText={commentDisplayText}
      />
      {hasTranslatedComment && (
        <div className="ml-7">
          <TranslationToggleButton
            active={showOriginalComment}
            onMouseDown={() => setShowOriginalComment(true)}
            onMouseUp={() => setShowOriginalComment(false)}
            onMouseLeave={() => setShowOriginalComment(false)}
            onTouchStart={() => setShowOriginalComment(true)}
            onTouchEnd={() => setShowOriginalComment(false)}
          />
        </div>
      )}
      {comment.queuedReplyText && (
        <div className="ml-7">
          <div className="text-[11px] text-accent-cyan-text/70 truncate">
            ↳ <span className="text-foreground-muted">{replyDisplayText}</span>
          </div>
          {hasTranslatedReply && (
            <TranslationToggleButton
              label="Show translation"
              active={showTranslatedReply}
              onMouseDown={() => setShowTranslatedReply(true)}
              onMouseUp={() => setShowTranslatedReply(false)}
              onMouseLeave={() => setShowTranslatedReply(false)}
              onTouchStart={() => setShowTranslatedReply(true)}
              onTouchEnd={() => setShowTranslatedReply(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
