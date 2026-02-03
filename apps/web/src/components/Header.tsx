"use client";

import { ConnectionStatus } from "@/components/ConnectionStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/providers/ConvexProvider";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

interface HeaderProps {
  showConnectionStatus?: boolean;
}

export function Header({ showConnectionStatus = false }: HeaderProps) {
  const { userId, isLoaded } = useAuth();
  const isSignedIn = !!userId;
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsVisible(currentScrollY < lastScrollY || currentScrollY < 50);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <header
      className={`border-b border-border bg-surface-elevated/50 backdrop-blur-sm sticky top-0 z-20 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-foreground hover:text-foreground-secondary transition-colors"
        >
          Tokative
        </Link>
        <div className="flex items-center gap-3">
          {showConnectionStatus && <ConnectionStatus />}
          <ThemeToggle />
          {isLoaded &&
            (isSignedIn ? (
              <SignOutButton>
                <button className="px-3 py-1.5 text-sm text-foreground-secondary hover:text-foreground border border-border hover:border-foreground-muted rounded-md transition-colors">
                  Sign Out
                </button>
              </SignOutButton>
            ) : (
              <Link
                href="/sign-in"
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Sign In
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
