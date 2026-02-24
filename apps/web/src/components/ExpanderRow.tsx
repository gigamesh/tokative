import { ChevronDown } from "lucide-react";
import { Spinner } from "./Spinner";

interface ExpanderRowProps {
  label: string;
  expanded: boolean;
  onClick: () => void;
  loading?: boolean;
}

export function ExpanderRow({ label, expanded, onClick, loading }: ExpanderRowProps) {
  return (
    <button
      onClick={onClick}
      className="ml-10 pl-4 border-l-2 border-border py-1 flex items-center gap-1.5 text-xs text-foreground-muted hover:text-accent-cyan-text transition-colors w-full text-left"
    >
      {loading ? (
        <Spinner size="sm" />
      ) : (
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      )}
      {label}
    </button>
  );
}
