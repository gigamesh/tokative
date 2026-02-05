import { ExternalLink } from "@/components/ExternalLink";
import NextLink from "next/link";
import { ComponentProps } from "react";

type LinkProps = ComponentProps<typeof NextLink> & {
  external?: boolean;
};

export function Link({ external, className = "", ...props }: LinkProps) {
  const baseClassName = "text-accent-cyan-text hover:text-accent-cyan-text-hover hover:underline";
  const combinedClassName = className
    ? `${baseClassName} ${className}`
    : baseClassName;

  if (external) {
    return (
      <ExternalLink
        href={props.href as string}
        className={combinedClassName}
        onClick={props.onClick as React.MouseEventHandler<HTMLAnchorElement>}
      >
        {props.children}
      </ExternalLink>
    );
  }

  return <NextLink {...props} className={combinedClassName} />;
}
