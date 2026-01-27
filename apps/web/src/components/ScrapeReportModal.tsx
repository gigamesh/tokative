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
      <h3 className="text-lg font-medium text-white mb-4">Scraping Complete</h3>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center py-2 border-b border-gray-700">
          <span className="text-gray-400">Found</span>
          <span className="text-white font-medium">{stats.found}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-700">
          <span className="text-gray-400">Stored</span>
          <span className="text-green-400 font-medium">{stats.stored}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-gray-700">
          <span className="text-gray-400">Skipped</span>
          <span className="text-gray-500 font-medium">{skipped}</span>
        </div>
      </div>

      <p className="text-gray-500 mb-6">
        Comments are skipped if they are already stored or if they match text in
        your{" "}
        <Link href="/dashboard?tab=settings" onClick={onClose}>
          ignore list
        </Link>
        .
      </p>

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
