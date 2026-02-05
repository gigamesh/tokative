import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/not-authorized",
  "/onboarding",
]);

function proxyClerkRequests(req: NextRequest) {
  if (!req.nextUrl.pathname.match("__clerk")) {
    return null;
  }

  const proxyHeaders = new Headers(req.headers);
  proxyHeaders.set(
    "Clerk-Proxy-Url",
    process.env.NEXT_PUBLIC_CLERK_PROXY_URL || ""
  );
  proxyHeaders.set("Clerk-Secret-Key", process.env.CLERK_SECRET_KEY || "");
  proxyHeaders.set(
    "X-Forwarded-For",
    req.ip || req.headers.get("X-Forwarded-For") || ""
  );

  const proxyUrl = new URL(req.url);
  proxyUrl.host = "frontend-api.clerk.dev";
  proxyUrl.port = "443";
  proxyUrl.protocol = "https";
  proxyUrl.pathname = proxyUrl.pathname.replace("/__clerk", "");

  return NextResponse.rewrite(proxyUrl, {
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
