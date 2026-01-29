import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

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
  return { clerkId: token };
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

    const body = await request.json();
    const result = await ctx.runMutation(api.comments.addBatch, {
      clerkId: auth.clerkId,
      comments: body.comments,
      ignoreList: body.ignoreList,
    });
    return jsonResponse(result);
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
      externalId: body.externalId,
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
    if (body.externalIds) {
      await ctx.runMutation(api.comments.removeBatch, {
        clerkId: auth.clerkId,
        externalIds: body.externalIds,
      });
    } else if (body.externalId) {
      await ctx.runMutation(api.comments.remove, {
        clerkId: auth.clerkId,
        externalId: body.externalId,
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

    const body = await request.json();
    const result = await ctx.runMutation(api.videos.addBatch, {
      clerkId: auth.clerkId,
      videos: body.videos,
    });
    return jsonResponse(result);
  }),
});

http.route({
  path: "/api/videos/mark-scraped",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

http.route({
  path: "/api/videos/mark-scraped",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    await ctx.runMutation(api.videos.markCommentsScraped, {
      clerkId: auth.clerkId,
      videoId: body.videoId,
      commentsScraped: body.commentsScraped,
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

    const body = await request.json();
    const userId = await ctx.runMutation(api.users.getOrCreate, {
      clerkId: auth.clerkId,
      email: body.email,
    });
    return jsonResponse({ userId });
  }),
});

export default http;
