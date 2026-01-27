import NextLink from "next/link";
import { ComponentProps } from "react";

type LinkProps = ComponentProps<typeof NextLink> & {
  external?: boolean;
};

export function Link({ external, className = "", ...props }: LinkProps) {
  const baseClassName = "text-blue-400 hover:text-blue-300 hover:underline";
  const combinedClassName = className
    ? `${baseClassName} ${className}`
    : baseClassName;

  if (external) {
    return (
      <a
        href={props.href as string}
        target="_blank"
        rel="noopener noreferrer"
        className={combinedClassName}
        onClick={props.onClick as React.MouseEventHandler<HTMLAnchorElement>}
      >
        {props.children}
      </a>
    );
  }

  return <NextLink {...props} className={combinedClassName} />;
}
