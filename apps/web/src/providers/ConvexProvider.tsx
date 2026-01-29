"use client";

import { ReactNode, createContext, useContext } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

const DEV_USER_ID = "dev-user-local";

const AuthContext = createContext<{ userId: string | null; isLoaded: boolean }>({
  userId: null,
  isLoaded: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

function DevAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ userId: DEV_USER_ID, isLoaded: true }}>
      {children}
    </AuthContext.Provider>
  );
}

function DevConvexProvider({ children }: { children: ReactNode }) {
  return (
    <DevAuthProvider>
      <ConvexProvider client={convex}>{children}</ConvexProvider>
    </DevAuthProvider>
  );
}

async function ClerkConvexProvider({ children }: { children: ReactNode }) {
  const { ClerkProvider, useAuth: useClerkAuth } = await import("@clerk/nextjs");
  const { ConvexProviderWithClerk } = await import("convex/react-clerk");

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!isClerkConfigured) {
    return <DevConvexProvider>{children}</DevConvexProvider>;
  }

  // Dynamic import for Clerk when configured
  const { ClerkProvider, useAuth: useClerkAuth } = require("@clerk/nextjs");
  const { ConvexProviderWithClerk } = require("convex/react-clerk");

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
