import { Link } from "./Link";
import { Modal } from "./Modal";

interface BulkReplyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    completed: number;
    failed: number;
    skipped: number;
  };
  deleteMissingComments: boolean | null;
}

export function BulkReplyReportModal({
  isOpen,
  onClose,
  stats,
  deleteMissingComments,
}: BulkReplyReportModalProps) {
  const total = stats.completed + stats.failed + stats.skipped;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3 className="text-lg font-medium text-foreground mb-4">Bulk Reply Complete</h3>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-foreground-muted">Total</span>
          <span className="text-foreground font-medium">{total}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-foreground-muted">Successful</span>
          <span className="text-green-400 font-medium">{stats.completed}</span>
        </div>
        {stats.failed > 0 && (
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-foreground-muted">Failed</span>
            <span className="text-red-400 font-medium">{stats.failed}</span>
          </div>
        )}
        {stats.skipped > 0 && (
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-foreground-muted">Skipped (missing)</span>
            <span className="text-yellow-400 font-medium">{stats.skipped}</span>
          </div>
        )}
      </div>

      {stats.skipped > 0 && (
        <p className="text-xs text-foreground-muted mb-6">
          Missing comments were{" "}
          {deleteMissingComments ? "automatically removed" : "kept for review"}.{" "}
          <Link href="/dashboard?tab=settings" onClick={onClose}>
            Change in Settings
          </Link>
        </p>
      )}

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm bg-tiktok-red hover:bg-tiktok-red/80 text-white rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
