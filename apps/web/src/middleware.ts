import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export async function middleware(request: NextRequest) {
  if (!isClerkConfigured) {
    return NextResponse.next();
  }

  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");

  const isPublicRoute = createRouteMatcher([
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/webhooks(.*)",
  ]);

  return clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) {
      await auth.protect();
    }
  })(request, {} as any);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
