import { Button } from "./Button";
import { Modal } from "./Modal";

interface ScrapeReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    found: number;
    new: number;
    preexisting: number;
  };
}

export function ScrapeReportModal({
  isOpen,
  onClose,
  stats,
}: ScrapeReportModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3 className="text-lg font-medium text-foreground mb-4">Collecting Complete</h3>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-foreground-muted">Found</span>
          <span className="text-foreground font-medium">{stats.found}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-foreground-muted">New</span>
          <span className="text-green-400 font-medium">{stats.new}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-foreground-muted">Preexisting</span>
          <span className="text-foreground-muted font-medium">{stats.preexisting}</span>
        </div>
      </div>

      <div className="text-xs text-foreground-muted space-y-2 mb-6">
        <p>
          <strong className="text-foreground-muted">Preexisting:</strong> Comments
          already stored.
        </p>
        <p>
          <strong className="text-foreground-muted">Note:</strong> The count shown by
          TikTok may be higher because it includes deleted comments that are no
          longer accessible.
        </p>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
