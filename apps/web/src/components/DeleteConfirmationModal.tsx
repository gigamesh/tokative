
import { Modal } from "./Modal";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchCount: number;
  commentText: string;
  onDeleteAll: () => void;
  onDeleteOne: () => void;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  matchCount,
  commentText,
  onDeleteAll,
  onDeleteOne,
}: DeleteConfirmationModalProps) {
  const truncatedText =
    commentText.length > 100 ? commentText.slice(0, 100) + "..." : commentText;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3 className="text-lg font-medium text-white mb-4">
        Delete matching comments?
      </h3>
      <p className="text-gray-400 mb-2">
        Found <span className="text-white font-medium">{matchCount}</span> other
        comment{matchCount > 1 ? "s" : ""} with the same text:
      </p>
      <p className="text-gray-500 text-sm mb-6 p-3 bg-gray-800 rounded-lg break-words">
        &ldquo;{truncatedText}&rdquo;
      </p>
      <p className="text-gray-400 mb-6">Delete all of them?</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onDeleteOne}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Just this one
        </button>
        <button
          onClick={onDeleteAll}
          className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
        >
          Delete all {matchCount + 1}
        </button>
      </div>
    </Modal>
  );
}
