import { Button } from "./Button";
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
      <h3 className="text-lg font-medium text-foreground mb-4">
        Delete matching comments?
      </h3>
      <p className="text-foreground-muted mb-2">
        Found <span className="text-foreground font-medium">{matchCount}</span> other
        comment{matchCount > 1 ? "s" : ""} with the same text:
      </p>
      <p className="text-foreground-muted text-sm mb-6 p-3 bg-surface-secondary rounded-lg break-words">
        &ldquo;{truncatedText}&rdquo;
      </p>
      <p className="text-foreground-muted mb-6">Delete all of them?</p>
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="ghost" onClick={onDeleteOne}>
          Just this one
        </Button>
        <Button variant="danger" onClick={onDeleteAll}>
          Delete all {matchCount + 1}
        </Button>
      </div>
    </Modal>
  );
}
