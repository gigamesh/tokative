interface ExpanderRowProps {
  count: number;
  expanded: boolean;
  onClick: () => void;
}

export function ExpanderRow({ count, expanded, onClick }: ExpanderRowProps) {
  return (
    <button
      onClick={onClick}
      className="ml-10 pl-4 border-l-2 border-border py-2 flex items-center gap-2 text-sm text-foreground-muted hover:text-accent-cyan-text transition-colors w-full text-left"
    >
      <svg
        className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
      {expanded
        ? "Hide replies"
        : `View ${count} more ${count === 1 ? "reply" : "replies"}`}
    </button>
  );
}
