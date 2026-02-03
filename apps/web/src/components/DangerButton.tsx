interface DangerButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function DangerButton({ onClick, disabled, children }: DangerButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 border border-red-400/50 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-foreground-muted disabled:border-border disabled:hover:bg-transparent"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      {children}
    </button>
  );
}
