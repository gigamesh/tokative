interface SpinnerProps {
  size?: "xs" | "sm" | "md";
  variant?: "default" | "danger";
  className?: string;
}

const sizeClasses = {
  xs: "w-3.5 h-3.5",
  sm: "w-4 h-4",
  md: "w-5 h-5",
};

const variantClasses = {
  default: "border-accent-cyan-text border-t-transparent",
  danger: "border-red-400 border-t-transparent",
};

export function Spinner({ size = "md", variant = "default", className }: SpinnerProps) {
  return (
    <div
      className={`border-2 ${variantClasses[variant]} rounded-full animate-spin flex-shrink-0 ${sizeClasses[size]} ${className ?? ""}`}
    />
  );
}
