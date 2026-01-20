# TikTok Buddy Implementation Plan

## Overview
Chrome extension + Next.js web app to manage TikTok interactions:
- Scrape user handles + comments from Activity > Notifications > Comments
- Display in a dashboard with search/filter
- Send customizable messages to users one-by-one via automated DM flow

## Architecture
Based on bstock-buddy patterns:
- **Turborepo monorepo** with pnpm
- **Three-layer messaging**: PostMessage (web↔bridge) → Chrome runtime (bridge↔background) → Ports (streaming)
- **Storage**: `chrome.storage.local` with abstraction layer for future DB migration

---

## File Structure

```
tiktok-buddy/
├── package.json              # Workspace config
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── apps/
│   ├── extension/
│   │   ├── public/
│   │   │   ├── manifest.json
│   │   │   └── popup.html
│   │   ├── src/
│   │   │   ├── types.ts                    # MessageType enum + interfaces
│   │   │   ├── background/
│   │   │   │   └── index.ts                # Service worker
│   │   │   ├── content/
│   │   │   │   ├── dashboard-bridge.ts     # localhost:3000 bridge
│   │   │   │   └── tiktok/
│   │   │   │       ├── index.ts            # TikTok content script entry
│   │   │   │       ├── notifications-scraper.ts
│   │   │   │       ├── profile-messenger.ts
│   │   │   │       └── selectors.ts
│   │   │   ├── popup/
│   │   │   │   └── index.ts
│   │   │   └── utils/
│   │   │       ├── storage.ts              # Abstract storage layer
│   │   │       └── dom.ts                  # waitForElement, scroll helpers
│   │   └── scripts/
│   │       └── build.js                    # esbuild bundler
│   └── web/
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── page.tsx
│           │   └── dashboard/
│           │       └── page.tsx
│           ├── components/
│           │   ├── UserTable.tsx
│           │   ├── UserCard.tsx
│           │   ├── MessageComposer.tsx
│           │   └── ConnectionStatus.tsx
│           ├── hooks/
│           │   ├── useUserData.ts
│           │   ├── useMessaging.ts
│           │   └── useTemplates.ts
│           └── utils/
│               ├── extension-bridge.ts
│               └── constants.ts
```

---

## Core Types

```typescript
interface ScrapedUser {
  id: string;
  handle: string;
  comment: string;
  scrapedAt: string;
  profileUrl: string;
  messageSent?: boolean;
  sentAt?: string;
  messageError?: string;
  customMessage?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  content: string;  // Supports {{handle}} and {{comment}} placeholders
  isDefault?: boolean;
}
```

---

## Message Types

| Type | Purpose |
|------|---------|
| `GET_STORED_USERS` | Fetch all scraped users |
| `USER_DATA_RESPONSE` | Return users + templates |
| `REMOVE_USER(S)` | Delete user(s) |
| `UPDATE_USER` | Update user status |
| `SCRAPE_COMMENTS_*` | Port-based scraping with progress |
| `SEND_MESSAGE` | Send single message |
| `BULK_SEND_*` | Port-based bulk sending with progress |
| `SAVE/DELETE_TEMPLATE` | Template management |
| `BRIDGE_READY/CHECK_BRIDGE` | Connection detection |

---

## Implementation Steps

### Phase 1: Project Setup
1. Initialize Turborepo monorepo with pnpm
2. Configure `turbo.json`, `tsconfig.json`, workspace
3. Set up extension with esbuild build scripts
4. Set up Next.js 14 with Tailwind

### Phase 2: Extension Foundation
1. Create `manifest.json` (Manifest V3)
2. Implement `types.ts` with all types
3. Build storage abstraction layer
4. Implement background service worker
5. Create dashboard-bridge.ts (from bstock-buddy pattern)
6. Test bridge communication

### Phase 3: TikTok Scraping
1. Research TikTok selectors (Activity → Notifications → Comments)
2. Implement `selectors.ts` with selector definitions
3. Build `notifications-scraper.ts`:
   - Click Activity button
   - Navigate to Comments tab
   - Scroll through infinite list
   - Extract handle + comment per item
4. Wire to background with port-based progress updates

### Phase 4: Web Dashboard
1. Implement `useUserData.ts` hook
2. Build UserTable component (search, filter, selection)
3. Build ConnectionStatus component
4. Create dashboard page with scrape trigger

### Phase 5: Message Templates
1. Add template storage to background
2. Build MessageComposer with:
   - Template selection
   - Live preview with placeholders
   - Per-user customization

### Phase 6: Message Automation
1. Research TikTok DM selectors
2. Implement `profile-messenger.ts`:
   - Open profile in new tab
   - Click message button
   - Wait for compose area
   - Type message with human-like delays
   - Click send, close tab
3. Add rate limiting (configurable delays)
4. Build progress UI for sending

---

## TikTok Selectors to Research

| Element | Strategy |
|---------|----------|
| Activity/Inbox button | `[data-e2e="inbox"]` or `[aria-label*="Inbox"]` |
| Comments filter tab | Tab within notifications modal |
| Comment item | List items in notification feed |
| User handle | Link element within comment |
| Comment text | Text content in comment item |
| Profile message button | `[data-e2e="message-button"]` |
| DM compose input | Input in message modal |
| Send button | Button in compose area |

---

## Key Challenges & Mitigations

| Challenge | Mitigation |
|-----------|------------|
| Dynamic TikTok selectors | Use `data-e2e`/`aria-*` attributes; implement fallback chains |
| Rate limiting / bot detection | Add 2-5s delays, randomize timing, limit messages/hour |
| Infinite scroll | Scroll-wait-extract loop with duplicate tracking |
| Session/login state | Check login before operations; show clear messages |
| Extension context invalidation | Use `guardExtensionContext` pattern; show refresh prompt |

---

## Verification Plan

1. **Extension loads**: Load unpacked extension, verify popup opens
2. **Bridge works**: Open localhost:3000, verify connection status shows "connected"
3. **Scraping works**:
   - Navigate to TikTok profile
   - Click "Start Scrape" in dashboard
   - Verify Activity opens, comments scroll, users appear in dashboard
4. **Templates work**: Create template with placeholders, verify preview
5. **Messaging works**:
   - Select a user, customize message
   - Click send, verify new tab opens, message sends, tab closes
   - Verify status updates to "sent" in dashboard
