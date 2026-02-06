# Tokative Data Layer

This document explains how Tokative stores and syncs data using Convex.

## What is Convex?

Convex is a backend-as-a-service that provides:

- **A database** - Document-based storage with TypeScript schema validation
- **Server functions** - TypeScript functions that run on Convex's servers
- **Real-time sync** - Data changes automatically push to connected clients
- **HTTP endpoints** - REST-like API for clients that can't use WebSockets

Think of it as Firebase/Supabase but with full TypeScript support and automatic real-time updates.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Convex Backend                              │
│                 (Source of Truth for user data)                 │
│  - Comments, Videos, Ignore List, Settings                      │
└─────────────────────────────────────────────────────────────────┘
                              ▲
          WebSocket           │           HTTP API
     ┌────────────────────────┴───────────────────────────┐
     │                                                    │
     ▼                                                    ▼
┌─────────────────┐                            ┌─────────────────┐
│    Web App      │                            │   Chrome        │
│   (Next.js)     │                            │   Extension     │
│                 │                            │                 │
└─────────────────┘                            └─────────────────┘
                                                       │
                                              Local Storage
                                              (ephemeral only)
                                              - Scraping state
                                              - Rate limit state
                                              - Auth token
```

**Convex Backend**: The authoritative source of truth for all user data. Comments, videos, ignore list, and settings are stored here and synced across all devices.

**Web App**: Uses Convex React hooks with WebSocket connection for real-time updates. When data changes anywhere, the UI updates instantly without polling or manual refresh.

**Chrome Extension**: Uses HTTP endpoints since extensions can't maintain persistent WebSocket connections. All data operations (read/write) go directly to Convex. Local storage is only used for ephemeral session state (scraping progress, rate limit tracking, auth token).

## Data Models

All data is defined in `/packages/convex/convex/schema.ts`:

### Users

```typescript
users: {
  clerkId: string,      // Clerk authentication ID
  createdAt: number,    // Unix timestamp
}
```

Every other table references users via `userId` to keep data isolated per user.

### Comments

```typescript
comments: {
  userId: Id<"users">,
  commentId: string,    // TikTok's unique comment ID (used for deduplication)
  handle: string,       // TikTok username
  comment: string,      // Comment text
  scrapedAt: number,
  profileUrl: string,
  avatarUrl?: string,
  videoUrl?: string,
  videoId?: string,

  // Reply tracking
  repliedTo?: boolean,
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
  order: number,            // Display order
  scrapedAt: number,
  commentsScraped?: boolean, // Whether comments have been scraped
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
  messageDelay: number,    // ms between messages
  scrollDelay: number,     // ms between scroll actions
  commentLimit?: number,   // Max comments per video
  postLimit?: number,      // Max posts to scrape
  accountHandle?: string,  // TikTok profile handle to scrape
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

The app uses Clerk for authentication:

```tsx
// providers/ConvexProvider.tsx
export function ConvexClientProvider({ children }) {
  return (
    <ClerkProvider publishableKey={...}>
      <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

The `useAuth()` hook exported from this provider returns `{ userId, isLoaded }`.

### Reading Data (Queries)

Use `useQuery` to subscribe to data. The component re-renders automatically when data changes:

```tsx
// hooks/useCommentData.ts
import { useQuery } from "convex/react";
import { api } from "@tokative/convex";

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
      commentId
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

### Convex-First Storage

The extension's storage layer uses Convex as the source of truth for all user data:

```typescript
// extension/src/utils/storage.ts
export async function addScrapedComments(newComments) {
  // Directly sync to Convex (source of truth)
  const ignoreList = await convexApi.fetchIgnoreList();
  return convexApi.syncComments(newComments, ignoreList.map(e => e.text));
}

export async function getScrapedComments() {
  // Fetch directly from Convex
  return convexApi.fetchComments();
}
```

This means:
- Convex is the single source of truth for user data
- All data operations (read/write) go directly to Convex
- Data syncs across all devices automatically
- Only ephemeral state (scraping progress, rate limits) stays in local storage

## Deduplication

Comments are deduplicated by `commentId` (TikTok's unique comment identifier). This prevents:

- Re-scraping the same video from creating duplicates
- Multiple devices scraping the same content

```typescript
// In addBatch mutation
const existing = await ctx.db.query("comments")
  .withIndex("by_user_and_comment_id", q =>
    q.eq("userId", user._id).eq("commentId", comment.commentId)
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

Tokative uses a **token relay** pattern where the user only needs to sign in once on the web app, and the extension automatically receives the authentication token.

### How It Works

```
┌─────────────────┐     message      ┌─────────────────┐     message      ┌─────────────────┐
│                 │    passing       │    Dashboard    │    passing       │                 │
│    Web App      │◄───────────────►│     Bridge      │◄───────────────►│   Background    │
│   (AuthBridge)  │  window.post    │  (content.js)   │  chrome.runtime  │    Script       │
│                 │    Message      │                 │    .sendMessage  │                 │
└─────────────────┘                 └─────────────────┘                  └─────────────────┘
       │                                                                        │
       │ Clerk userId                                                           │ Store in
       │                                                                        │ chrome.storage
       ▼                                                                        ▼
   User signs in                                                     Extension has auth
   to web app                                                        for HTTP requests
```

### Authentication Flow

1. **User signs in** to the web app using Clerk

2. **AuthBridge component** in the web app does two things:
   - Proactively broadcasts the token when user signs in
   - Responds to `GET_AUTH_TOKEN` requests from the extension
   ```tsx
   // apps/web/src/components/AuthBridge.tsx
   // Proactive broadcast on sign-in
   useEffect(() => {
     if (isLoaded && userId && previousUserId.current !== userId) {
       window.postMessage({
         type: "AUTH_TOKEN_RESPONSE",
         payload: { token: userId },
       }, "*");
     }
   }, [userId, isLoaded]);

   // Also responds to explicit requests
   window.addEventListener("message", (event) => {
     if (event.data?.type === "GET_AUTH_TOKEN") {
       window.postMessage({
         type: "AUTH_TOKEN_RESPONSE",
         payload: { token: userId },
       }, "*");
     }
   });
   ```

3. **Extension requests token** when it needs to make API calls:
   ```typescript
   // Extension's convex-api.ts
   const token = await getOrRequestAuthToken();
   // If no token stored, requests from web app via message passing
   ```

4. **Dashboard bridge** (content script on web app page) relays messages between the page and background script

5. **Background script** stores the token in `chrome.storage.local` for future requests

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

**apps/web/.env.local:**
```
# Required - Get from `npx convex dev` output
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210

# Required - Get from Clerk dashboard (https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

The Convex package itself doesn't require environment variables for local development.

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

## File Structure

```
packages/convex/
├── convex/
│   ├── _generated/      # Auto-generated types (don't edit)
│   ├── schema.ts        # Database schema
│   ├── users.ts         # User management
│   ├── comments.ts      # Comments CRUD
│   ├── videos.ts        # Videos CRUD
│   ├── ignoreList.ts    # Ignore list operations
│   ├── settings.ts      # User settings
│   └── http.ts          # HTTP endpoints for extension
├── tests/               # Integration tests
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
