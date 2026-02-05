import { Button } from "./Button";
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
      <h3 className="text-lg font-medium text-foreground mb-4">
        Comment not found
      </h3>
      <p className="text-foreground-muted mb-6">
        This comment may have been deleted by the author or removed by TikTok.
        Would you like to remove it from your list?
      </p>
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Keep it
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Remove comment
        </Button>
      </div>
    </Modal>
  );
}
