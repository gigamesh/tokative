"use client";

import { ConnectionStatus } from "@/components/ConnectionStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/providers/ConvexProvider";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function Header() {
  const { userId, isLoaded } = useAuth();
  const isSignedIn = !!userId;
  const pathname = usePathname();
  const showConnectionStatus = pathname === "/dashboard";
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
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold text-gradient-brand hover:opacity-80 transition-opacity"
        >
          Tokative
        </Link>
        <div className="flex items-center gap-6">
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
