import { BulkReplyProgress } from "@tokative/shared";
import { X } from "lucide-react";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

interface ReplyProgressPanelProps {
  bulkReplyProgress: BulkReplyProgress;
  replyStatusMessage: string | null;
  onStop: () => void;
  onDismiss: () => void;
}

export function ReplyProgressPanel({
  bulkReplyProgress,
  replyStatusMessage,
  onStop,
  onDismiss,
}: ReplyProgressPanelProps) {
  const isActive = bulkReplyProgress.status === "running";
  const processed =
    bulkReplyProgress.completed +
    bulkReplyProgress.failed +
    bulkReplyProgress.commentNotFound +
    bulkReplyProgress.mentionFailed +
    bulkReplyProgress.detectionFailed;

  return (
    <div className="bg-surface-elevated rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive && <Spinner size="sm" />}
          <span className="text-sm font-medium text-foreground">
            Reply Progress
          </span>
        </div>
        {isActive ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStop}
            className="text-xs text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
          >
            Stop
          </Button>
        ) : (
          <button
            onClick={onDismiss}
            className="p-0.5 text-foreground-muted hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-foreground-muted">
          {processed} / {bulkReplyProgress.total}
        </span>
        {isActive && bulkReplyProgress.current && (
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
  );
}
