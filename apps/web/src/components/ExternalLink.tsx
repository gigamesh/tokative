import { AnchorHTMLAttributes, forwardRef } from "react";

type ExternalLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "target" | "rel"
>;

export const ExternalLink = forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  function ExternalLink({ children, ...props }, ref) {
    return (
      <a ref={ref} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
);
