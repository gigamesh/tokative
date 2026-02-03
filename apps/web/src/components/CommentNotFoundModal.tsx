
import { Modal } from "./Modal";

interface CommentNotFoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function CommentNotFoundModal({
  isOpen,
  onClose,
  onDelete,
}: CommentNotFoundModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3 className="text-lg font-medium text-white mb-4">
        Comment not found
      </h3>
      <p className="text-gray-400 mb-6">
        This comment may have been deleted by the author or removed by TikTok.
        Would you like to remove it from your list?
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Keep it
        </button>
        <button
          onClick={onDelete}
          className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
        >
          Remove comment
        </button>
      </div>
    </Modal>
  );
}
