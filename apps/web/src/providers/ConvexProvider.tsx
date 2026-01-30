"use client";

import { ReactNode, createContext, useContext } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

const DEV_USER_ID = "dev-user-local";
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const AuthContext = createContext<{ userId: string | null; isLoaded: boolean }>({
  userId: null,
  isLoaded: false,
});

function useDevAuth() {
  return useContext(AuthContext);
}

function useClerkAuthWrapper() {
  const { userId, isLoaded } = useClerkAuth();
  return { userId: userId ?? null, isLoaded };
}

export const useAuth = isClerkConfigured ? useClerkAuthWrapper : useDevAuth;

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

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!isClerkConfigured) {
    return <DevConvexProvider>{children}</DevConvexProvider>;
  }

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
