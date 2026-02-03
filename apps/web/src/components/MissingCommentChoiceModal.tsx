import { Modal } from "./Modal";

interface MissingCommentChoiceModalProps {
  isOpen: boolean;
  onSkip: () => void;
  onDelete: () => void;
}

export function MissingCommentChoiceModal({
  isOpen,
  onSkip,
  onDelete,
}: MissingCommentChoiceModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onSkip}>
      <h3 className="text-lg font-medium text-white mb-4">
        How should we handle missing comments?
      </h3>
      <p className="text-gray-400 mb-6">
        During bulk reply, some comments may no longer exist on TikTok (deleted by the author or removed by TikTok).
        How would you like to handle these?
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onSkip}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
        >
          Skip (keep in list)
        </button>
        <button
          onClick={onDelete}
          className="px-4 py-2 text-sm bg-tiktok-red hover:bg-tiktok-red/80 text-white rounded-lg transition-colors"
        >
          Delete (remove from list)
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-4 text-center">
        You can change this later in Settings
      </p>
    </Modal>
  );
}
