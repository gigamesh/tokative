import { ScrapedComment } from "@/utils/constants";
import { BulkReplyProgress, CommentReplyStatus } from "@tokative/shared";
import { ListX, Trash2, X } from "lucide-react";
import { Button } from "./Button";
import { CompactCommentCard } from "./CompactCommentCard";
import { Spinner } from "./Spinner";

interface QueuePanelProps {
  queuedComments: ScrapedComment[];
  onDequeue: (commentIds: string[]) => void;
  onClearQueue: () => void;
  onStartReply: () => void;
  onStopReply: () => void;
  isReplying: boolean;
  bulkReplyProgress: BulkReplyProgress | null;
  replyStatusMessage: string | null;
  replyLimitReached: boolean;
  replyBudget: number;
}

export function QueuePanel({
  queuedComments,
  onDequeue,
  onClearQueue,
  onStartReply,
  onStopReply,
  isReplying,
  bulkReplyProgress,
  replyStatusMessage,
  replyLimitReached,
  replyBudget,
}: QueuePanelProps) {
  const isActive = bulkReplyProgress?.status === "running";
  const isFinished =
    bulkReplyProgress?.status === "complete" ||
    bulkReplyProgress?.status === "stopped";
  const processed = bulkReplyProgress
    ? bulkReplyProgress.completed +
      bulkReplyProgress.failed +
      bulkReplyProgress.commentNotFound +
      bulkReplyProgress.mentionFailed +
      bulkReplyProgress.detectionFailed
    : 0;

  return (
    <div className="bg-surface-elevated rounded-lg p-4 space-y-3">
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
            onClick={onClearQueue}
            icon={<ListX />}
            className="text-xs"
          >
            Clear All
          </Button>
        )}
      </div>

      {queuedComments.length === 0 && !isFinished && (
        <p className="text-sm text-foreground-muted py-4 text-center">
          Select comments and add them to the queue to get started.
        </p>
      )}

      {queuedComments.length > 0 && (
        <div className="max-h-64 overflow-y-auto space-y-1 pr-1 scrollbar-visible">
          {queuedComments.map((comment) => (
            <QueuedCommentItem
              key={comment.id}
              comment={comment}
              onRemove={() => onDequeue([comment.id])}
              status={bulkReplyProgress?.commentStatuses?.[comment.id]}
              isActive={isActive}
            />
          ))}
        </div>
      )}

      {(isActive || isFinished) && bulkReplyProgress && (
        <div className="p-3 bg-surface border border-border rounded-lg space-y-2">
          {isActive && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span className="text-xs font-medium text-foreground">
                  Reply Progress
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onStopReply}
                className="text-xs text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
              >
                Stop
              </Button>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-foreground-muted">
              {processed} / {bulkReplyProgress.total}
            </span>
            {bulkReplyProgress.current && (
              <span className="text-foreground-muted">
                @{bulkReplyProgress.current}
              </span>
            )}
          </div>
          {isActive && replyStatusMessage && (
            <p className="text-xs text-foreground-muted">
              {replyStatusMessage}
            </p>
          )}
          <div className="w-full bg-surface-secondary rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{
                width: `${bulkReplyProgress.total > 0 ? (processed / bulkReplyProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex gap-3 text-xs">
            <span className="text-green-600 dark:text-green-400">
              {bulkReplyProgress.completed} sent
            </span>
            {bulkReplyProgress.failed > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {bulkReplyProgress.failed} failed
              </span>
            )}
            {bulkReplyProgress.commentNotFound > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {bulkReplyProgress.commentNotFound} not found
              </span>
            )}
            {bulkReplyProgress.mentionFailed > 0 && (
              <span className="text-orange-600 dark:text-orange-400">
                {bulkReplyProgress.mentionFailed} mention failed
              </span>
            )}
          </div>
        </div>
      )}

      {!isActive && (
        <Button
          variant="secondary"
          fullWidth
          onClick={onStartReply}
          disabled={
            queuedComments.length === 0 || replyLimitReached || isReplying
          }
        >
          {replyLimitReached
            ? "Reply Limit Reached"
            : queuedComments.length === 0
              ? "Queue Empty"
              : `Start Replying (${Math.min(queuedComments.length, replyBudget)})`}
        </Button>
      )}
    </div>
  );
}

function QueuedCommentItem({
  comment,
  onRemove,
  status,
  isActive,
}: {
  comment: ScrapedComment;
  onRemove: () => void;
  status?: CommentReplyStatus;
  isActive?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <CompactCommentCard
        comment={comment}
        onRemove={onRemove}
        status={status}
      />
      {comment.queuedReplyText && (
        <div className="ml-7 text-[11px] text-foreground-muted truncate">
          <span className="text-accent-cyan-text/70">→</span>{" "}
          {comment.queuedReplyText}
        </div>
      )}
    </div>
  );
}
