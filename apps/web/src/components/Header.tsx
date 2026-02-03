"use client";

import { ConnectionStatus } from "@/components/ConnectionStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/providers/ConvexProvider";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

interface HeaderProps {
  showConnectionStatus?: boolean;
}

export function Header({ showConnectionStatus = false }: HeaderProps) {
  const { userId, isLoaded } = useAuth();
  const isSignedIn = !!userId;

  return (
    <header className="border-b border-border bg-surface-elevated/50 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-xl font-bold text-foreground hover:text-foreground-secondary transition-colors"
        >
          Tokative
        </Link>
        <div className="flex items-center gap-4">
          {showConnectionStatus && <ConnectionStatus />}
          <ThemeToggle />
          {isLoaded &&
            (isSignedIn ? (
              <SignOutButton>
                <button className="px-4 py-2 text-sm text-foreground-secondary hover:text-foreground border border-border hover:border-foreground-muted rounded-md transition-colors">
                  Sign Out
                </button>
              </SignOutButton>
            ) : (
              <Link
                href="/sign-in"
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Sign In
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
