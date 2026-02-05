import { Button } from "./Button";
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
      <h3 className="text-lg font-medium text-foreground mb-4">
        How should we handle missing comments?
      </h3>
      <p className="text-foreground-muted mb-6">
        During bulk reply, some comments may no longer exist on TikTok (deleted by the author or removed by TikTok).
        How would you like to handle these?
      </p>
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onSkip}>
          Skip (keep in list)
        </Button>
        <Button variant="secondary" onClick={onDelete}>
          Delete (remove from list)
        </Button>
      </div>
      <p className="text-xs text-foreground-muted mt-4 text-center">
        You can change this later in Settings
      </p>
    </Modal>
  );
}
