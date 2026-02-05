import { Button } from "./Button";
import { Trash2 } from "lucide-react";

interface DangerButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function DangerButton({ onClick, disabled, children }: DangerButtonProps) {
  return (
    <Button
      variant="soft-danger"
      size="sm"
      icon={<Trash2 />}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
