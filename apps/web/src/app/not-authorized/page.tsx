"use client";

import { Button } from "@/components/Button";
import { SignOutButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { AlertTriangle } from "lucide-react";

export default function NotAuthorizedPage() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="min-h-content bg-surface flex justify-center pt-[20vh] p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-surface-elevated rounded-lg p-8 shadow-lg">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            Access Restricted
          </h1>
          <p className="text-foreground-muted mb-6">
            Tokative is currently in private beta. Your account is not on the
            approved testers list.
          </p>

          {email && (
            <div className="bg-surface rounded-lg p-4 mb-6">
              <p className="text-sm text-foreground-muted">Signed in as</p>
              <p className="text-foreground font-medium">{email}</p>
            </div>
          )}

          <p className="text-sm text-foreground-muted mb-6">
            If you believe you should have access, please contact the team to be
            added to the whitelist.
          </p>

          <SignOutButton>
            <Button variant="outline" size="lg" fullWidth>
              Sign Out
            </Button>
          </SignOutButton>
        </div>
      </div>
    </div>
  );
}
