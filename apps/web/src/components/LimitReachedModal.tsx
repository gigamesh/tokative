import { Button } from "./Button";
import { Modal } from "./Modal";
import Link from "next/link";

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "comments" | "replies";
  used: number;
  limit: number;
  plan: string;
  scrapeStats?: { found: number; new: number; preexisting: number; ignored: number };
  replyStats?: { completed: number; failed: number; skipped: number };
}

export function LimitReachedModal({
  isOpen,
  onClose,
  type,
  used,
  limit,
  plan,
  scrapeStats,
  replyStats,
}: LimitReachedModalProps) {
  const title = type === "comments" ? "Comment Limit Reached" : "Reply Limit Reached";
  const noun = type === "comments" ? "comment" : "reply";

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3 className="text-lg font-medium text-foreground mb-4">{title}</h3>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-foreground-muted">Monthly usage</span>
          <span className="text-red-400 font-medium">
            {used.toLocaleString()} / {limit.toLocaleString()}
          </span>
        </div>
        <div className="w-full h-2 bg-surface-secondary rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-red-500 w-full" />
        </div>
      </div>

      <p className="text-sm text-foreground-muted mb-4">
        You've reached your <span className="text-foreground capitalize">{plan}</span> plan's
        monthly {noun} limit.
      </p>

      {scrapeStats && (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center py-1.5 border-b border-border">
            <span className="text-foreground-muted text-sm">New</span>
            <span className="text-green-400 font-medium text-sm">{scrapeStats.new}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-border">
            <span className="text-foreground-muted text-sm">Preexisting</span>
            <span className="text-foreground-muted font-medium text-sm">{scrapeStats.preexisting}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-border">
            <span className="text-foreground-muted text-sm">Ignored</span>
            <span className="text-foreground-muted font-medium text-sm">{scrapeStats.ignored}</span>
          </div>
        </div>
      )}

      {replyStats && (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center py-1.5 border-b border-border">
            <span className="text-foreground-muted text-sm">Sent</span>
            <span className="text-green-400 font-medium text-sm">{replyStats.completed}</span>
          </div>
          {replyStats.failed > 0 && (
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <span className="text-foreground-muted text-sm">Failed</span>
              <span className="text-red-400 font-medium text-sm">{replyStats.failed}</span>
            </div>
          )}
          {replyStats.skipped > 0 && (
            <div className="flex justify-between items-center py-1.5 border-b border-border">
              <span className="text-foreground-muted text-sm">Skipped</span>
              <span className="text-yellow-400 font-medium text-sm">{replyStats.skipped}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Link href="/pricing">
          <Button variant="primary" onClick={onClose}>Upgrade</Button>
        </Link>
      </div>
    </Modal>
  );
}
