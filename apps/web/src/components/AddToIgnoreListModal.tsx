import { Link } from "./Link";
import { Modal } from "./Modal";

interface AddToIgnoreListModalProps {
  isOpen: boolean;
  onClose: () => void;
  commentText: string;
  onConfirm: () => void;
  onSkip: () => void;
}

export function AddToIgnoreListModal({
  isOpen,
  onClose,
  commentText,
  onConfirm,
  onSkip,
}: AddToIgnoreListModalProps) {
  const truncatedText =
    commentText.length > 100 ? commentText.slice(0, 100) + "..." : commentText;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3 className="text-lg font-medium text-white mb-4">
        Add to Ignore List?
      </h3>
      <p className="text-gray-400 mb-2">
        Do you also want to add this text to your ignore list to automatically
        skip matching comments when scraping in the future?
      </p>
      <p className="text-gray-500 text-sm mb-6 p-3 bg-gray-800 rounded-lg break-words">
        &ldquo;{truncatedText}&rdquo;
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onSkip}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          No, skip
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm bg-tiktok-red hover:bg-red-500 text-white rounded-lg transition-colors"
        >
          Yes, add to ignore list
        </button>
      </div>
      <p className="text-sm text-gray-500 mt-4 text-center">
        You can manage your ignore list in the{" "}
        <Link href="/dashboard?tab=settings" onClick={onClose}>
          settings tab
        </Link>
        .
      </p>
    </Modal>
  );
}
