import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-surface">
      <div className="max-w-[1400px] mx-auto px-4 py-4 flex justify-end gap-8">
        <Link
          href="/privacy"
          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          Terms
        </Link>
      </div>
    </footer>
  );
}
