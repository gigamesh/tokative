interface SpinnerProps {
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={`border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0 ${sizeClasses[size]} ${className ?? ""}`}
    />
  );
}
