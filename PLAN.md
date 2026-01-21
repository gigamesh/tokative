# TikTok Buddy Video Scraping Refactor Plan

## Goal

Refactor the extension to scrape comments from video pages instead of notifications, capturing richer data (timestamps, thumbnails), display in a virtualized feed sorted by time, and store reply/message content.

---

## Phase 1: Validation

**Objective:** Confirm we can capture timestamps and all other needed data from video page comments.

### Tasks

- [x] **1.1** Navigate to a video page manually and inspect React props on comment elements ✅
  - React props accessible via `__reactFiber$` key on `DivCommentItemContainer` elements
  - Full data structure available in React fiber's memoizedProps

- [x] **1.2** Confirm `create_time` (or equivalent timestamp) exists in comment data ✅
  - Found: `create_time` available in React props

- [x] **1.3** Confirm video thumbnail URL is accessible ✅
  - Found: Available from `og:image` meta tag on video page

- [x] **1.4** Confirm comment ID (`cid`) is accessible on video page comments ✅
  - Found: `cid` in React props AND in DOM `id` attribute on `DivCommentContentContainer`

- [x] **1.5** Document the complete data structure we can extract ✅
  - See Data Structure Reference below

### Validation Method

I'll provide you with a small script to run in the browser console that will:
1. Select a comment element on a video page
2. Extract and log the full React props structure
3. Show exactly what data is available

---

## Phase 2: Selector Discovery & Test Setup

**Objective:** Find all DOM selectors needed and write tests before implementation.

### 2A: Profile Page Selectors

- [ ] **2A.1** Video grid container selector
- [ ] **2A.2** Individual video item selector
- [ ] **2A.3** Video thumbnail/poster image selector
- [ ] **2A.4** Video item click target

### 2B: Video Modal Selectors

- [x] **2B.1** Video modal/player container ✅ `[class*="DivBrowserModeContainer"]`
- [x] **2B.2** Close button selector ✅ `[data-e2e="browse-close"]`
- [x] **2B.3** Comments section container ✅ `[class*="DivCommentListContainer"]`
- [x] **2B.4** Individual comment element ✅ `[class*="DivCommentItemContainer"]`
- [x] **2B.5** Comment username element ✅ `[data-e2e="comment-username-1"]`
- [x] **2B.6** Comment text element ✅ `[data-e2e="comment-text"]`
- [x] **2B.7** Comment timestamp element ✅ `[data-e2e="comment-time-1"]`

### 2C: Test Setup

- [x] **2C.1** Create test file for video scraper ✅
- [x] **2C.2** Write tests for selector utilities (querySelector, waitForSelector) ✅
- [ ] **2C.3** Write tests for React props extraction
- [x] **2C.4** Write tests for comment data parsing ✅
- [ ] **2C.5** Write tests for storage migration

### Selector Discovery Process

For each selector needed, I'll ask you to:
1. Navigate to the relevant page
2. Right-click the target element → Inspect
3. Copy the outer HTML of the element
4. Share the HTML snippet so I can identify the selector

---

## Phase 3: Implementation (TDD)

**Objective:** Implement features test-first.

### 3A: Data Model & Types

- [x] **3A.1** Update `ScrapedUser` interface with new fields ✅
- [x] **3A.2** Add `VideoScrapeProgress` interface ✅
- [x] **3A.3** Add new `MessageType` enums ✅
- [x] **3A.4** Mirror types in web app ✅

### 3B: Storage Migration

- [ ] **3B.1** Add storage version tracking
- [ ] **3B.2** Implement v1 → v2 migration
  - Extract `commentId`/`videoId` from existing `videoUrl`
  - Set `commentTimestamp` to `scrapedAt` as fallback
- [ ] **3B.3** Call migration on extension load
- [ ] **3B.4** Test migration with sample data

### 3C: Video Scraper

- [x] **3C.1** Create `video-selectors.ts` with discovered selectors ✅
- [x] **3C.2** Create `video-scraper.ts` skeleton ✅
- [ ] **3C.3** Implement `waitForProfileLoad()`
- [ ] **3C.4** Implement `getVideoThumbnails()`
- [ ] **3C.5** Implement video navigation (click → scrape → close)
- [x] **3C.6** Implement `scrapeAllCommentsOnVideo()` ✅
- [x] **3C.7** Implement React props extraction for video comments ✅
- [x] **3C.8** Implement progress reporting ✅
- [x] **3C.9** Implement cancellation support ✅
- [x] **3C.10** Wire up to content script message handler ✅
- [ ] **3C.11** Wire up to background script orchestration

### 3D: Reply/Message Content Storage

- [ ] **3D.1** Update reply handler to store `replyContent`
- [ ] **3D.2** Update message handler to store `messageContent`

### 3E: Web App Updates

- [ ] **3E.1** Install `@tanstack/react-virtual`
- [ ] **3E.2** Update `UserCard` with thumbnail display
- [ ] **3E.3** Update `UserCard` with comment timestamp display
- [ ] **3E.4** Update `UserTable` with virtualization
- [ ] **3E.5** Add sorting controls (by comment time, scraped time)
- [ ] **3E.6** Test with large dataset

---

## Phase 4: Integration Testing

- [ ] **4.1** End-to-end test: scrape from profile videos
- [ ] **4.2** Verify all data fields populated correctly
- [ ] **4.3** Test scraping cancellation
- [ ] **4.4** Test migration with existing data
- [ ] **4.5** Test web app performance with 500+ comments
- [ ] **4.6** Test reply functionality still works
- [ ] **4.7** Test DM functionality still works

---

## Files Reference

### Created ✅
| File | Purpose | Status |
|------|---------|--------|
| `apps/extension/src/content/tiktok/video-scraper.ts` | Main video scraping logic | ✅ Created |
| `apps/extension/src/content/tiktok/video-selectors.ts` | Video page selectors | ✅ Created |
| `apps/extension/src/content/tiktok/__tests__/video-scraper.test.ts` | Scraper tests | ✅ Created |

### Modified ✅
| File | Purpose | Status |
|------|---------|--------|
| `apps/extension/src/types.ts` | Add new fields and message types | ✅ Modified |
| `apps/extension/src/content/tiktok/index.ts` | Wire up video scraper | ✅ Modified |
| `apps/web/src/utils/constants.ts` | Mirror types | ✅ Modified |

### To Modify (Remaining)
| File | Purpose |
|------|---------|
| `apps/extension/src/background/index.ts` | Handle video scraping + content storage |
| `apps/extension/src/utils/storage.ts` | Migration logic |
| `apps/web/src/components/UserCard.tsx` | Thumbnail + timestamp display |
| `apps/web/src/components/UserTable.tsx` | Virtualization + sorting |
| `apps/web/package.json` | Add react-virtual dependency |

---

## Current Status

**Phase:** 3 - Implementation (TDD)
**Completed:**
- Phase 1: Validation ✅
- Phase 2B: Video Modal Selectors ✅
- Phase 2C: Test Setup (partial) ✅
- Phase 3A: Data Model & Types ✅
- Phase 3C: Video Scraper (core functionality) ✅

**Next Steps:**
- Phase 2A: Profile page selectors (for multi-video scraping)
- Phase 3B: Storage migration
- Phase 3C.11: Background script orchestration
- Phase 3D: Reply/Message content storage
- Phase 3E: Web app updates

---

## Notes

### Phase 1 Validation Results (Completed)

**Data Extraction Methods:**

| Data | Source | Method |
|------|--------|--------|
| `create_time` | React props | `__reactFiber$` on `DivCommentItemContainer` |
| `cid` | React props OR DOM | React fiber OR `id` attr on `DivCommentContentContainer` |
| `aweme_id` | React props OR URL | React fiber OR parse from video URL |
| Video thumbnail | Meta tag | `document.querySelector('meta[property="og:image"]')` |
| Username | DOM | `[data-e2e="comment-username-1"]` |
| Comment text | DOM | `[data-e2e="comment-text"]` |

**Key Selectors Discovered:**
- Comment container: `[class*="DivCommentItemContainer"]`
- Comment content: `[class*="DivCommentContentContainer"]` (has `id` attr with comment ID)
- Username: `[data-e2e="comment-username-1"]`
- Comment text: `[data-e2e="comment-text"]`
- Reply button: `[data-e2e="comment-reply-1"]`
