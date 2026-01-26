
import { Modal } from "./Modal";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}: ConfirmationModalProps) {
  const confirmButtonClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-500"
      : "bg-tiktok-red hover:bg-red-500";

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h3 className="text-lg font-medium text-white mb-4">{title}</h3>
      <p className="text-gray-400 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-4 py-2 text-sm ${confirmButtonClass} text-white rounded-lg transition-colors`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
