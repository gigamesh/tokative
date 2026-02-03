import { Link } from "./Link";
import { Modal } from "./Modal";

interface ScrapeReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    found: number;
    stored: number;
    ignored: number;
    duplicates: number;
  };
}

export function ScrapeReportModal({
  isOpen,
  onClose,
  stats,
}: ScrapeReportModalProps) {
  const skipped = stats.ignored + stats.duplicates;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3 className="text-lg font-medium text-foreground mb-4">Scraping Complete</h3>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-foreground-muted">Found</span>
          <span className="text-foreground font-medium">{stats.found}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-foreground-muted">Stored</span>
          <span className="text-green-400 font-medium">{stats.stored}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-foreground-muted">Skipped</span>
          <span className="text-foreground-muted font-medium">{skipped}</span>
        </div>
      </div>

      <div className="text-xs text-foreground-muted space-y-2 mb-6">
        <p>
          <strong className="text-foreground-muted">Skipped:</strong> Comments
          previously stored or matching text in your{" "}
          <Link href="/dashboard?tab=settings" onClick={onClose}>
            ignore list
          </Link>
          .
        </p>
        <p>
          <strong className="text-foreground-muted">Note:</strong> The count shown by
          TikTok may be higher because it includes deleted comments that are no
          longer accessible.
        </p>
      </div>

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
