"use client";

interface FetchCommentsButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function FetchCommentsButton({ onClick, disabled }: FetchCommentsButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 border border-blue-400/50 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-400 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-gray-400 disabled:border-gray-600 disabled:hover:bg-transparent"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Fetch Comments
    </button>
  );
}
