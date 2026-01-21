# TikTok Buddy - Two-Step Video & Comment Scraping

## Overview

TikTok Buddy is a browser extension + web dashboard for scraping TikTok comments and enabling bulk messaging/reply workflows.

### Current Architecture
- **Extension** (`apps/extension/`): Chrome extension with content scripts for TikTok interaction
- **Web App** (`apps/web/`): Next.js dashboard that communicates with extension via message bridge
- **Communication**: Extension background script acts as bridge between TikTok content scripts and web dashboard

### Key Files
| File | Purpose |
|------|---------|
| `apps/extension/src/types.ts` | Shared types for extension |
| `apps/extension/src/content/tiktok/video-scraper.ts` | Video/comment scraping logic |
| `apps/extension/src/content/tiktok/index.ts` | Content script message handlers |
| `apps/extension/src/background/index.ts` | Background script orchestration |
| `apps/extension/src/utils/storage.ts` | Chrome storage wrapper |
| `apps/web/src/utils/constants.ts` | Mirrored types for web app |
| `apps/web/src/hooks/useUserData.ts` | React hook for user/comment data |
| `apps/web/src/app/dashboard/page.tsx` | Main dashboard UI |

---

## Goal

Implement a two-step scraping workflow:
1. **Scrape Videos** - Collect video metadata (thumbnail, ID, URL) from profile grid
2. **Get Comments** - On-demand per video, triggered from dashboard

---

## User Flow
1. User navigates to a TikTok profile page
2. Clicks "Start Scraping" in dashboard **Videos** section
3. Extension scrapes all videos from the profile grid (with infinite scroll)
4. Dashboard displays video grid with thumbnails
5. User clicks "Get Comments" on any video
6. Extension opens TikTok tab, navigates to video, scrapes comments
7. Comments appear in dashboard linked to that video

---

## Implementation Plan

### Phase 1: Video Metadata Scraping (Extension)

#### 1.1 Data Model - DONE
New `ScrapedVideo` interface in `types.ts`:
```typescript
interface ScrapedVideo {
  id: string;
  videoId: string;           // TikTok video ID (e.g., "7596052026111347998")
  thumbnailUrl: string;      // Video thumbnail from grid
  videoUrl: string;          // Full URL to video page
  profileHandle: string;     // Which profile this video belongs to
  order: number;             // Position in grid (for maintaining order)
  scrapedAt: string;         // ISO timestamp
  commentsScraped?: boolean; // Has "Get Comments" been run?
  commentCount?: number;     // How many comments scraped
}
```

#### 1.2 Message Types - DONE
Added to `MessageType` enum:
- `SCRAPE_VIDEOS_START/PROGRESS/COMPLETE/ERROR/STOP` - Video metadata scraping
- `GET_VIDEO_COMMENTS/PROGRESS/COMPLETE/ERROR` - Get comments for specific video
- `GET_STORED_VIDEOS/VIDEOS_RESPONSE` - Video storage access

#### 1.3 Storage Functions - DONE
Added to `storage.ts`:
- `getVideos(): Promise<ScrapedVideo[]>`
- `saveVideos(videos: ScrapedVideo[]): Promise<void>`
- `addVideos(videos: ScrapedVideo[]): Promise<number>` (dedupes by videoId)
- `updateVideo(videoId: string, updates: Partial<ScrapedVideo>): Promise<void>`
- `removeVideo(videoId: string): Promise<void>`
- `clearVideos(): Promise<void>`

#### 1.4 Scraper Function - IN PROGRESS
Create `scrapeProfileVideoMetadata()` in `video-scraper.ts`:
- Scroll through profile grid with infinite scroll
- Extract from each video item:
  - Video ID (from href)
  - Thumbnail URL (from img)
  - Video URL (construct from ID)
  - Order/position index
- Save incrementally to storage (idempotent by videoId)
- Progress reporting via callback

#### 1.5 Content Script Wiring - PENDING
Add handlers in `content/tiktok/index.ts`:
- `SCRAPE_VIDEOS_START` - Start video metadata scraping
- `SCRAPE_VIDEOS_STOP` - Cancel scraping

### Phase 2: Background Script Orchestration

#### 2.1 Get Comments Flow - PENDING
Handle `GET_VIDEO_COMMENTS` message in `background/index.ts`:
1. Receive videoId from dashboard
2. Look up video URL from storage
3. Open/navigate TikTok tab to video
4. Wait for page load
5. Send `SCRAPE_VIDEO_COMMENTS_START` to content script
6. Relay progress/completion back to dashboard
7. Update video record with `commentsScraped: true` and `commentCount`

### Phase 3: Web Dashboard

#### 3.1 Types Update - PENDING
Mirror new types in `apps/web/src/utils/constants.ts`:
- Add `ScrapedVideo` interface
- Add new message type constants
- Add `VideoMetadataScrapeProgress` interface

#### 3.2 useVideoData Hook - PENDING
Create `apps/web/src/hooks/useVideoData.ts`:
- Fetch videos from storage
- Start/stop video scraping
- Trigger "Get Comments" for specific video
- Track scraping progress

#### 3.3 VideoCard Component - PENDING
Create `apps/web/src/components/VideoCard.tsx`:
- Display video thumbnail
- Checkbox for selection (controlled by parent)
- Comment count badge (if already scraped)
- Visual indicator for "comments scraped" state

#### 3.4 VideoGrid Component - PENDING
Create `apps/web/src/components/VideoGrid.tsx`:
- Header with:
  - "Select All" checkbox (with indeterminate state)
  - "Start Scraping" button (when no videos or to refresh)
  - Bulk action buttons (visible when selection > 0):
    - Trash button (delete selected videos)
    - Refetch/Get Comments button (scrape comments for selected videos)
  - Selection count display
- Grid layout matching TikTok's style
- Display VideoCards with selection state
- Empty state when no videos
- Shift-click for range selection (like bstock-buddy AuctionTable)

#### 3.5 Dashboard Integration - PENDING
Update `apps/web/src/app/dashboard/page.tsx`:
- Add Videos section (after Scraping, before Comments)
- "Start Scraping" button for video metadata
- Progress indicator during scrape
- VideoGrid display

---

## Implementation Progress

### Completed
- [x] Add `ScrapedVideo` type to `types.ts`
- [x] Add `VideoMetadataScrapeProgress` type to `types.ts`
- [x] Add video message types to `MessageType` enum
- [x] Add video storage functions to `storage.ts`
- [x] Create `scrapeProfileVideoMetadata()` in `video-scraper.ts`
- [x] Wire up video scraping handlers in `content/tiktok/index.ts`
- [x] Add background script orchestration for "Get Comments"
- [x] Update web app types in `constants.ts`
- [x] Create `useVideoData` hook
- [x] Create `VideoCard` component (with checkbox selection)
- [x] Create `VideoGrid` component (with bulk actions: trash, get comments, settings toggle)
- [x] Combine old "Scraping" section into Videos section
- [x] Remove notifications-scraper.ts (old activity/notifications scraping)
- [x] Clean up all SCRAPE_COMMENTS_* and SCRAPE_PROFILE_* message types
- [x] Remove old scraping state from useUserData hook

---

## Existing Code to Leverage

These features from previous work are still valid and will be reused:
- `scrapeVideoComments()` - scrapes comments from a video page (works)
- Comment data extraction (handle, text, commentId, timestamp)
- Incremental saving during scroll
- React props extraction via `page-script.js`
- Deduplication by commentId
- `extractThumbnailFromVideoItem()` and `extractVideoIdFromVideoItem()` helpers

---

## Verification Checklist

1. **Video scraping**: Navigate to profile, start scrape, verify all videos collected with correct order
2. **Idempotency**: Run scrape again, verify no duplicates
3. **Dashboard display**: Verify video grid shows thumbnails in correct order
4. **Get Comments**: Click button, verify TikTok opens, comments scraped, linked to video
5. **Progress**: Verify progress indicators work for both operations
