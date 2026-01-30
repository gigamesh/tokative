"use client";

import Link from "next/link";
import { useAuth } from "@/providers/ConvexProvider";
import { SignOutButton } from "@clerk/nextjs";
import { ConnectionStatus } from "@/components/ConnectionStatus";

interface HeaderProps {
  showConnectionStatus?: boolean;
}

export function Header({ showConnectionStatus = false }: HeaderProps) {
  const { userId, isLoaded } = useAuth();
  const isSignedIn = !!userId;

  return (
    <header className="border-b border-gray-800 bg-tiktok-gray/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-white hover:text-gray-200 transition-colors">
          TikTok Buddy
        </Link>
        <div className="flex items-center gap-4">
          {showConnectionStatus && <ConnectionStatus />}
          {isLoaded && (
            isSignedIn ? (
              <SignOutButton>
                <button className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-md transition-colors">
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
            )
          )}
        </div>
      </div>
    </header>
  );
}
