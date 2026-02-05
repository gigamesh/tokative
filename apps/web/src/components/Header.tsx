"use client";

import { ConnectionStatus } from "@/components/ConnectionStatus";
import { HelpModal } from "@/components/HelpModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useHelpModal } from "@/hooks/useHelpModal";
import { useAuth } from "@/providers/ConvexProvider";
import { SignOutButton } from "@clerk/nextjs";
import { HelpCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function Header() {
  const { userId, isLoaded } = useAuth();
  const isSignedIn = !!userId;
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const { isOpen, hasSeenHelp, openModal, closeModal } = useHelpModal();

  useEffect(() => {
    if (isDashboard && hasSeenHelp === false) {
      openModal();
    }
  }, [isDashboard, hasSeenHelp, openModal]);

  return (
    <header className="bg-surface sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold text-gradient-brand hover:opacity-80 transition-opacity"
        >
          Tokative
        </Link>
        <div className="flex items-center gap-6">
          {isDashboard && <ConnectionStatus />}
          {isDashboard && (
            <button
              onClick={openModal}
              className="text-sm text-foreground-muted hover:text-foreground transition-colors"
              title="Help"
            >
              <HelpCircle className="w-[18px] h-[18px]" />
            </button>
          )}
          <ThemeToggle />
          {isLoaded &&
            (isSignedIn ? (
              <SignOutButton>
                <button className="text-sm text-foreground-muted hover:text-foreground transition-colors">
                  Sign Out
                </button>
              </SignOutButton>
            ) : (
              <Link
                href="/sign-in"
                className="text-sm text-foreground-muted hover:text-foreground transition-colors"
              >
                Sign In
              </Link>
            ))}
        </div>
      </div>
      <HelpModal isOpen={isOpen} onClose={closeModal} />
    </header>
  );
}
