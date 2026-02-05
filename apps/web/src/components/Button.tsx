"use client";

import { cloneElement, forwardRef, isValidElement } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "soft"
  | "soft-danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-brand text-white dark:text-black hover:shadow-lg hover:shadow-accent-pink/25 disabled:bg-none disabled:!bg-surface-secondary disabled:text-foreground-muted disabled:shadow-none",
  secondary:
    "bg-accent-cyan-solid text-white hover:bg-accent-cyan-solid-hover disabled:bg-surface-secondary disabled:text-foreground-muted",
  outline:
    "border border-border text-foreground-secondary hover:text-foreground hover:border-foreground-muted disabled:opacity-50",
  ghost:
    "text-foreground-muted hover:text-foreground disabled:opacity-50",
  danger:
    "bg-red-600 text-white hover:bg-red-500 disabled:bg-surface-secondary disabled:text-foreground-muted",
  soft:
    "text-accent-cyan-solid border border-accent-cyan-solid bg-accent-cyan-500/10 hover:bg-accent-cyan-500/20 hover:border-accent-cyan-solid-hover disabled:opacity-40 disabled:bg-transparent disabled:text-foreground-muted disabled:border-border disabled:hover:bg-transparent",
  "soft-danger":
    "text-red-400 border border-red-400/50 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400 disabled:opacity-40 disabled:bg-transparent disabled:text-foreground-muted disabled:border-border disabled:hover:bg-transparent",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      pill = false,
      fullWidth = false,
      icon,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-1.5 font-medium transition-all disabled:cursor-not-allowed";
    const roundedStyle = pill ? "rounded-full" : "rounded-lg";
    const widthStyle = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${roundedStyle} ${widthStyle} ${className}`}
        {...props}
      >
        {icon && isValidElement(icon) && cloneElement(icon, { className: "w-4 h-4 flex-shrink-0" } as React.HTMLAttributes<HTMLElement>)}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

interface LinkButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  icon?: React.ReactNode;
}

export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      pill = false,
      icon,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-1.5 font-medium transition-all";
    const roundedStyle = pill ? "rounded-full" : "rounded-lg";

    return (
      <a
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${roundedStyle} ${className}`}
        {...props}
      >
        {icon && isValidElement(icon) && cloneElement(icon, { className: "w-4 h-4 flex-shrink-0" } as React.HTMLAttributes<HTMLElement>)}
        {children}
      </a>
    );
  }
);

LinkButton.displayName = "LinkButton";
