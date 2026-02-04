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
      className={`bg-surface/80 backdrop-blur-md sticky top-0 z-20 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium text-foreground hover:opacity-70 transition-opacity"
        >
          Tokative
        </Link>
        <div className="flex items-center gap-4">
          {showConnectionStatus && <ConnectionStatus />}
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
    </header>
  );
}
