import { Button } from "./Button";
import { Trash2 } from "lucide-react";
import { Spinner } from "./Spinner";

interface DangerButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  className?: string;
  children: React.ReactNode;
}

export function DangerButton({ onClick, disabled, loading, loadingText = "", className, children }: DangerButtonProps) {
  return (
    <Button
      variant="soft-danger"
      size="sm"
      icon={loading ? <Spinner size="sm" variant="danger" /> : <Trash2 />}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${loading ? "!opacity-100" : ""} ${className ?? ""}`}
    >
      {loading ? `${loadingText}…` : children}
    </Button>
  );
}
