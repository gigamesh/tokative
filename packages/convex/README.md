# TikTok Buddy Data Layer

This document explains how TikTok Buddy stores and syncs data using Convex.

## What is Convex?

Convex is a backend-as-a-service that provides:

- **A database** - Document-based storage with TypeScript schema validation
- **Server functions** - TypeScript functions that run on Convex's servers
- **Real-time sync** - Data changes automatically push to connected clients
- **HTTP endpoints** - REST-like API for clients that can't use WebSockets

Think of it as Firebase/Supabase but with full TypeScript support and automatic real-time updates.

## Why Convex?

Before Convex, TikTok Buddy stored all data in Chrome's local storage (`chrome.storage.local`). This had limitations:

| Problem | Solution with Convex |
|---------|---------------------|
| Data trapped on one device | Cloud storage accessible from anywhere |
| No sync between browsers | Real-time sync across all connected clients |
| Manual refresh to see updates | Automatic UI updates when data changes |
| No user accounts | Authentication via Clerk |

## Architecture Overview

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│                 │◄──────────────────►│                 │
│    Web App      │   (real-time)      │     Convex      │
│   (Next.js)     │                    │    Backend      │
│                 │                    │                 │
└─────────────────┘                    └─────────────────┘
                                              ▲
┌─────────────────┐     HTTP API              │
│                 │◄──────────────────────────┘
│   Chrome        │   (REST-like)
│   Extension     │
│                 │
└─────────────────┘
```

**Web App**: Uses Convex React hooks with WebSocket connection for real-time updates. When data changes anywhere, the UI updates instantly without polling or manual refresh.

**Chrome Extension**: Uses HTTP endpoints since extensions can't maintain persistent WebSocket connections. The extension syncs data to Convex whenever it scrapes comments or videos.

## Data Models

All data is defined in `/packages/convex/convex/schema.ts`:

### Users

```typescript
users: {
  clerkId: string,      // Clerk authentication ID
  email?: string,
  tiktokHandle?: string,
  createdAt: number,    // Unix timestamp
}
```

Every other table references users via `userId` to keep data isolated per user.

### Comments

```typescript
comments: {
  userId: Id<"users">,
  externalId: string,   // Original ID for deduplication (handle-commentId)
  handle: string,       // TikTok username
  comment: string,      // Comment text
  scrapedAt: number,
  profileUrl: string,
  avatarUrl?: string,
  videoUrl?: string,
  videoId?: string,

  // Reply tracking
  replySent?: boolean,
  repliedAt?: number,
  replyContent?: string,
  replyError?: string,

  // Thread structure
  parentCommentId?: string,
  isReply?: boolean,
  replyCount?: number,
}
```

### Videos

```typescript
videos: {
  userId: Id<"users">,
  videoId: string,
  thumbnailUrl: string,
  videoUrl: string,
  profileHandle: string,
  order: number,         // Display order
  scrapedAt: number,
  commentsScraped?: boolean,
}
```

### Ignore List

```typescript
ignoreList: {
  userId: Id<"users">,
  text: string,          // Text pattern to ignore
  addedAt: number,
}
```

### Settings

```typescript
settings: {
  userId: Id<"users">,
  messageDelay: number,  // ms between messages
  scrollDelay: number,   // ms between scroll actions
  commentLimit?: number, // Max comments per video
  postLimit?: number,    // Max posts to scrape
}
```

## Server Functions

Convex has three types of functions:

### Queries (Read-only)

Queries read data and automatically re-run when underlying data changes:

```typescript
// convex/comments.ts
export const list = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users")
      .withIndex("by_clerk_id", q => q.eq("clerkId", args.clerkId))
      .unique();

    return await ctx.db.query("comments")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect();
  },
});
```

### Mutations (Write)

Mutations modify data:

```typescript
// convex/comments.ts
export const addBatch = mutation({
  args: {
    clerkId: v.string(),
    comments: v.array(v.object({ ... })),
    ignoreList: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Deduplication logic
    // Insert new comments
    return { stored, duplicates, ignored };
  },
});
```

### HTTP Actions

HTTP endpoints for the Chrome extension:

```typescript
// convex/http.ts
http.route({
  path: "/api/comments/batch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = verifyAuth(request);
    const body = await request.json();

    const result = await ctx.runMutation(api.comments.addBatch, {
      clerkId: auth.clerkId,
      comments: body.comments,
    });

    return new Response(JSON.stringify(result));
  }),
});
```

## Using Convex in the Web App

### Provider Setup

The app is wrapped with Convex and Clerk providers:

```tsx
// app/layout.tsx
<ClerkProvider>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    {children}
  </ConvexProviderWithClerk>
</ClerkProvider>
```

### Reading Data (Queries)

Use `useQuery` to subscribe to data. The component re-renders automatically when data changes:

```tsx
// hooks/useCommentData.ts
import { useQuery } from "convex/react";
import { api } from "@tiktok-buddy/convex";

function useCommentData() {
  const { userId } = useAuth();

  // This automatically updates when comments change!
  const comments = useQuery(
    api.comments.list,
    userId ? { clerkId: userId } : "skip"
  );

  return { comments: comments ?? [], loading: comments === undefined };
}
```

The `"skip"` parameter tells Convex not to run the query until we have a userId.

### Writing Data (Mutations)

Use `useMutation` to get a function that writes data:

```tsx
import { useMutation } from "convex/react";

function CommentActions() {
  const removeComment = useMutation(api.comments.remove);

  const handleDelete = async (commentId: string) => {
    await removeComment({
      clerkId: userId,
      externalId: commentId
    });
    // No need to refetch - UI updates automatically!
  };
}
```

## Using Convex in the Extension

The extension uses HTTP endpoints since it can't use WebSockets:

```typescript
// extension/src/utils/convex-api.ts
export async function syncComments(comments: ScrapedComment[]) {
  const token = await getAuthToken();

  const response = await fetch(`${CONVEX_URL}/api/comments/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ comments }),
  });

  return response.json(); // { stored, duplicates, ignored }
}
```

### Automatic Sync

The extension's storage layer automatically syncs to Convex:

```typescript
// extension/src/utils/storage.ts
export async function addScrapedComments(newComments) {
  // 1. Save to local storage (fast, works offline)
  await saveToLocalStorage(newComments);

  // 2. Sync to Convex in background (doesn't block)
  tryConvexSync(() => convexApi.syncComments(newComments));
}
```

This means:
- Local storage is the source of truth for the extension
- Convex sync happens in the background
- If sync fails, data is still saved locally

## Deduplication

Comments are deduplicated by `externalId` (a composite of handle + commentId). This prevents:

- Re-scraping the same video from creating duplicates
- Multiple devices scraping the same content

```typescript
// In addBatch mutation
const existing = await ctx.db.query("comments")
  .withIndex("by_user_and_external_id", q =>
    q.eq("userId", user._id).eq("externalId", comment.externalId)
  )
  .unique();

if (existing) {
  duplicates++;
  continue; // Skip this comment
}
```

## Ignore List Integration

The ignore list filters comments during batch add:

```typescript
const ignoreTexts = args.ignoreList.map(t => t.toLowerCase());

for (const comment of comments) {
  if (ignoreTexts.some(text =>
    comment.comment.toLowerCase().includes(text)
  )) {
    ignored++;
    continue; // Skip ignored comments
  }
}
```

## Authentication

Authentication uses Clerk:

1. **Web App**: Clerk React components handle login/signup
2. **Convex**: Validates Clerk JWT tokens
3. **Extension**: Stores auth token and sends with HTTP requests

The `clerkId` is passed to every Convex function to identify the user.

## Local Development

### 1. Install Dependencies

```bash
cd packages/convex
pnpm install
```

### 2. Start Convex Dev Server

```bash
pnpm dev
# or from repo root:
pnpm dev:convex
```

This:
- Starts a local Convex backend
- Watches for file changes and hot-reloads functions
- Syncs your schema to the dev deployment
- Opens a dashboard at the URL shown in terminal

### 3. Environment Variables

Create `.env.local` files:

**packages/convex/.env.local:**
```
CONVEX_DEPLOYMENT=dev:your-project-name
```

**apps/web/.env.local:**
```
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

### 4. Run the Web App

```bash
cd apps/web
pnpm dev
```

## Testing

Tests use `convex-test` which provides an in-memory Convex backend:

```bash
cd packages/convex
pnpm test        # Watch mode
pnpm test:run    # Single run
```

### Writing Tests

```typescript
import { convexTest } from "convex-test";
import { api } from "../_generated/api";
import schema from "../schema";

const t = convexTest(schema, modules);

it("stores new comments", async () => {
  // Create a test user
  const clerkId = "test-user";
  await t.run(ctx => ctx.db.insert("users", {
    clerkId,
    createdAt: Date.now()
  }));

  // Call the mutation
  const result = await t.mutation(api.comments.addBatch, {
    clerkId,
    comments: [{ externalId: "1", handle: "user", comment: "Hello" }],
  });

  expect(result.stored).toBe(1);

  // Verify with query
  const comments = await t.query(api.comments.list, { clerkId });
  expect(comments).toHaveLength(1);
});
```

## File Structure

```
packages/convex/
├── convex/
│   ├── _generated/      # Auto-generated types (don't edit)
│   ├── tests/           # Integration tests
│   ├── schema.ts        # Database schema
│   ├── users.ts         # User management
│   ├── comments.ts      # Comments CRUD
│   ├── videos.ts        # Videos CRUD
│   ├── ignoreList.ts    # Ignore list operations
│   ├── settings.ts      # User settings
│   ├── http.ts          # HTTP endpoints for extension
│   └── auth.config.ts   # Clerk auth configuration
├── index.ts             # Package exports
├── package.json
├── tsconfig.json
└── vitest.config.ts     # Test configuration
```

## Common Tasks

### Add a new field to a table

1. Update `schema.ts`
2. Run `pnpm dev` to sync schema
3. Update relevant queries/mutations
4. Update types in shared package if needed

### Add a new endpoint for the extension

1. Add HTTP route in `http.ts`
2. Add corresponding function in `convex-api.ts`
3. Call from extension storage layer

### Debug a query

Use the Convex dashboard (URL shown when running `pnpm dev`) to:
- View all data in tables
- Run queries manually
- See function logs
- Monitor real-time subscriptions
