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
  return (
    <div className={`bg-surface-elevated rounded-lg px-4 pb-4 ${className ?? ""}`}>
      {stickyHeader && (
        <div className="sticky top-[135px] z-20 bg-surface-elevated pt-4">
          {stickyHeader}
        </div>
      )}
      {children}
    </div>
  );
}
