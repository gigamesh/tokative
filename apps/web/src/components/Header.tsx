"use client";

import { ConnectionStatus } from "@/components/ConnectionStatus";
import { HelpModal } from "@/components/HelpModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useHelpModal } from "@/hooks/useHelpModal";
import { useAuth } from "@/providers/ConvexProvider";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { isAdminEmail } from "@/utils/admin";
import { BILLING_ENABLED } from "@tokative/convex";
import { HelpCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ComponentProps, useEffect } from "react";

const navLinkClass = "text-sm text-foreground-muted hover:text-foreground transition-colors";

function NavLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} className={navLinkClass} />;
}

function NavButton(props: ComponentProps<"button">) {
  return <button {...props} className={navLinkClass} />;
}

export function Header() {
  const { userId, isLoaded } = useAuth();
  const { user } = useUser();
  const isSignedIn = !!userId;
  const isAdmin = isAdminEmail(user?.primaryEmailAddress?.emailAddress);
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
          {isLoaded && isSignedIn && (
            <NavLink href="/dashboard">Dashboard</NavLink>
          )}
          {BILLING_ENABLED && isLoaded && isSignedIn && (
            <NavLink href="/account">Account</NavLink>
          )}
          {isLoaded && isSignedIn && isAdmin && (
            <NavLink href="/admin">Admin</NavLink>
          )}
          {isLoaded && isSignedIn ? (
            <SignOutButton>
              <NavButton>Sign Out</NavButton>
            </SignOutButton>
          ) : (
            // <NavLink href="/sign-in">Sign In</NavLink>
            null
          )}
          {isDashboard && (
            <button
              onClick={openModal}
              className={navLinkClass}
              title="Help"
            >
              <HelpCircle className="w-[18px] h-[18px]" />
            </button>
          )}
          {isDashboard && <ConnectionStatus />}
          <ThemeToggle />
        </div>
      </div>
      <HelpModal isOpen={isOpen} onClose={closeModal} />
    </header>
  );
}
