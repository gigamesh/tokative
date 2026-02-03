
import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
  variant?: "success" | "error";
}

export function Toast({ message, isVisible, onClose, duration = 3000, variant = "success" }: ToastProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const isError = variant === "error";

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] transition-all duration-200 ${
        isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className={`${isError ? "bg-red-900/80 border-red-700" : "bg-gray-900 border-gray-700"} border text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 max-w-sm`}>
        {isError ? (
          <svg
            className="w-5 h-5 text-red-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-green-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        <span className="text-sm">{message}</span>
      </div>
    </div>
  );
}
