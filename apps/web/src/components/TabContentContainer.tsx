import { useEffect, useState } from "react";

interface TabContentContainerProps {
  children: React.ReactNode;
  stickyHeader?: React.ReactNode;
  className?: string;
}

export function TabContentContainer({
  children,
  stickyHeader,
  className,
}: TabContentContainerProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 0);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={`bg-surface-elevated rounded-lg px-4 pb-4 ${className ?? ""}`}>
      {stickyHeader && (
        <div className={`sticky top-[135px] z-20 bg-surface-elevated pt-4 ${scrolled ? "before:content-[''] before:absolute before:left-0 before:right-0 before:bottom-full before:h-[5px] before:bg-surface-elevated" : ""}`}>
          {stickyHeader}
        </div>
      )}
      {children}
    </div>
  );
}
