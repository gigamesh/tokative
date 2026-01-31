import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

function base64UrlDecode(str: string): string {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  while (base64.length % 4) {
    base64 += "=";
  }
  return atob(base64);
}

function parseJwt(token: string): { sub: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

async function verifyAuth(
  request: Request
): Promise<{ clerkId: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  if (!token) {
    return null;
  }

  const parsed = parseJwt(token);
  if (!parsed) {
    return null;
  }
  return { clerkId: parsed.sub };
}

async function ensureUserExists(
  ctx: { runMutation: typeof import("./_generated/server").ActionCtx["runMutation"] },
  clerkId: string
): Promise<void> {
  await ctx.runMutation(api.users.getOrCreate, { clerkId });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

http.route({
  path: "/api/comments",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/comments",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const comments = await ctx.runQuery(api.comments.list, {
      clerkId: auth.clerkId,
    });
    return jsonResponse(comments);
  }),
});

http.route({
  path: "/api/comments/batch",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/comments/batch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    try {
      await ensureUserExists(ctx, auth.clerkId);

      const body = await request.json();
      const result = await ctx.runMutation(api.comments.addBatch, {
        clerkId: auth.clerkId,
        comments: body.comments,
        ignoreList: body.ignoreList,
      });
      return jsonResponse(result);
    } catch (error) {
      console.error("Error in /api/comments/batch:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return errorResponse(message, 500);
    }
  }),
});

http.route({
  path: "/api/comments",
  method: "PUT",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    await ctx.runMutation(api.comments.update, {
      clerkId: auth.clerkId,
      commentId: body.commentId,
      updates: body.updates,
    });
    return jsonResponse({ success: true });
  }),
});

http.route({
  path: "/api/comments",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    if (body.commentIds) {
      await ctx.runMutation(api.comments.removeBatch, {
        clerkId: auth.clerkId,
        commentIds: body.commentIds,
      });
    } else if (body.commentId) {
      await ctx.runMutation(api.comments.remove, {
        clerkId: auth.clerkId,
        commentId: body.commentId,
      });
    }
    return jsonResponse({ success: true });
  }),
});

http.route({
  path: "/api/videos",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/videos",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const videos = await ctx.runQuery(api.videos.list, {
      clerkId: auth.clerkId,
    });
    return jsonResponse(videos);
  }),
});

http.route({
  path: "/api/videos/batch",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/videos/batch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    await ensureUserExists(ctx, auth.clerkId);

    const body = await request.json();
    const result = await ctx.runMutation(api.videos.addBatch, {
      clerkId: auth.clerkId,
      videos: body.videos,
    });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/api/videos",
  method: "PUT",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    await ctx.runMutation(api.videos.update, {
      clerkId: auth.clerkId,
      videoId: body.videoId,
      updates: body.updates,
    });
    return jsonResponse({ success: true });
  }),
});

http.route({
  path: "/api/videos",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    if (body.videoIds) {
      await ctx.runMutation(api.videos.removeBatch, {
        clerkId: auth.clerkId,
        videoIds: body.videoIds,
      });
    } else if (body.videoId) {
      await ctx.runMutation(api.videos.remove, {
        clerkId: auth.clerkId,
        videoId: body.videoId,
      });
    }
    return jsonResponse({ success: true });
  }),
});

http.route({
  path: "/api/ignore-list",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/ignore-list",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const entries = await ctx.runQuery(api.ignoreList.list, {
      clerkId: auth.clerkId,
    });
    return jsonResponse(entries);
  }),
});

http.route({
  path: "/api/ignore-list",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    await ctx.runMutation(api.ignoreList.add, {
      clerkId: auth.clerkId,
      text: body.text,
    });
    return jsonResponse({ success: true });
  }),
});

http.route({
  path: "/api/ignore-list",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    await ctx.runMutation(api.ignoreList.remove, {
      clerkId: auth.clerkId,
      text: body.text,
    });
    return jsonResponse({ success: true });
  }),
});

http.route({
  path: "/api/settings",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/settings",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const settings = await ctx.runQuery(api.settings.get, {
      clerkId: auth.clerkId,
    });
    return jsonResponse(settings);
  }),
});

http.route({
  path: "/api/settings",
  method: "PUT",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    await ctx.runMutation(api.settings.update, {
      clerkId: auth.clerkId,
      settings: body,
    });
    return jsonResponse({ success: true });
  }),
});

http.route({
  path: "/api/scraping/context",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/scraping/context",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const ignoreList = await ctx.runQuery(api.ignoreList.list, {
      clerkId: auth.clerkId,
    });
    const comments = await ctx.runQuery(api.comments.list, {
      clerkId: auth.clerkId,
    });

    return jsonResponse({
      ignoreList: ignoreList.map((e) => e.text),
      existingCommentIds: comments.map((c) => c.commentId).filter(Boolean),
    });
  }),
});

http.route({
  path: "/api/users/ensure",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/users/ensure",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const userId = await ctx.runMutation(api.users.getOrCreate, {
      clerkId: auth.clerkId,
    });
    return jsonResponse({ userId });
  }),
});

export default http;
