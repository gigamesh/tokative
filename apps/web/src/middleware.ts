import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/api/webhooks(.*)",
  "/not-authorized",
  "/onboarding",
  "/pricing",
  "/privacy",
  "/terms",
]);

function proxyClerkRequests(req: NextRequest) {
  const proxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
  if (!proxyUrl || !req.nextUrl.pathname.match("__clerk")) {
    return null;
  }

  const proxyHeaders = new Headers(req.headers);
  proxyHeaders.set("Clerk-Proxy-Url", proxyUrl);
  proxyHeaders.set("Clerk-Secret-Key", process.env.CLERK_SECRET_KEY || "");
  proxyHeaders.set(
    "X-Forwarded-For",
    req.ip || req.headers.get("X-Forwarded-For") || ""
  );

  const rewriteUrl = new URL(req.url);
  rewriteUrl.host = "frontend-api.clerk.dev";
  rewriteUrl.port = "443";
  rewriteUrl.protocol = "https";
  rewriteUrl.pathname = rewriteUrl.pathname.replace("/__clerk", "");

  return NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: proxyHeaders,
    },
  });
}

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth().protect();
  }
});

export default function middleware(req: NextRequest) {
  const proxyResponse = proxyClerkRequests(req);
  if (proxyResponse) {
    return proxyResponse;
  }
  return clerkHandler(req, {} as any);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc|__clerk)(.*)",
  ],
};
