interface ListPanelProps {
  stickyHeader: React.ReactNode;
  children: React.ReactNode;
  scrollRef: (el: HTMLDivElement | null) => void;
}

export function ListPanel({ stickyHeader, children, scrollRef }: ListPanelProps) {
  return (
    <div>
      <div className="bg-surface-elevated pt-4 space-y-4">
        {stickyHeader}
      </div>
      <div ref={scrollRef} className="overflow-x-hidden scrollbar-visible max-h-panel pr-2">
        {children}
      </div>
    </div>
  );
}
