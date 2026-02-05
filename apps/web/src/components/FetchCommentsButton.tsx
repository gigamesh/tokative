import { Button } from "./Button";
import { RefreshCw } from "lucide-react";

interface FetchCommentsButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function FetchCommentsButton({
  onClick,
  disabled,
}: FetchCommentsButtonProps) {
  return (
    <Button
      variant="soft"
      size="sm"
      icon={<RefreshCw />}
      onClick={onClick}
      disabled={disabled}
    >
      Fetch Comments
    </Button>
  );
}
