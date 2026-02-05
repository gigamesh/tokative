"use client";

import { ConnectionStatus } from "@/components/ConnectionStatus";
import { HelpModal } from "@/components/HelpModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useHelpModal } from "@/hooks/useHelpModal";
import { useAuth } from "@/providers/ConvexProvider";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Header() {
  const { userId, isLoaded } = useAuth();
  const isSignedIn = !!userId;
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const { isOpen, hasSeenHelp, openModal, closeModal } = useHelpModal();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsVisible(currentScrollY < lastScrollY || currentScrollY < 50);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    if (isDashboard && hasSeenHelp === false) {
      openModal();
    }
  }, [isDashboard, hasSeenHelp, openModal]);

  return (
    <header
      className={`bg-surface/80 backdrop-blur-md sticky top-0 z-20 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
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
