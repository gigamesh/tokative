# Language Translation Feature for Tokative

## Status: Phases 1–5 Complete

All code changes are implemented. Phase 6 (migration & verification) requires manual steps.

---

## What Was Built

1. **Language detection** — `franc-min` detects language of every incoming comment server-side (Convex mutation), stores ISO 639-1 code
2. **Per-comment translation** — "Translate" button on non-native-language comments, calls Google Cloud Translate v2
3. **Global translation controls** — "Show translations" toggle + "Translate All" button on both Comments and Commenters tabs
4. **Reply translation** — "Respond in commenter's language" checkbox in ReplyComposer auto-translates outbound replies
5. **Feature gating** — All UI gated behind `WHITELISTED_EMAILS` via `features.translation` from `getAccessStatus`

---

## Architecture

```
Incoming comments
  → addBatch (Convex mutation)
  → detectLanguages (franc-min, inline in same mutation)
  → stores detectedLanguage on comment doc

Translation (on demand)
  → User clicks "Translate" or "Translate All"
  → Convex action calls Google Cloud Translate v2 REST API
  → Stores translatedText on comment doc

Reply translation
  → User checks "Respond in commenter's language"
  → Dashboard calls translateReplyText action (batch translates message variations per language)
  → Attaches messageToSend to each comment before sending to extension
  → Extension uses messageToSend as reply text instead of original messages
  → replyOriginalContent stored for audit trail
```

**Translation API**: Google Cloud Translate v2 (REST), keyed by `GOOGLE_TRANSLATE_API_KEY` Convex env var
**Language detection**: `franc-min` running inline in Convex mutations (server-side)
**Target language**: User's browser language (`navigator.language`)

---

## Implementation Details

### Phase 1: Backend — Schema, Detection, Translation Infrastructure

**Schema changes** (`packages/convex/convex/schema.ts`):
- `detectedLanguage: v.optional(v.string())` — ISO 639-1 code (e.g. "es", "fr", "ja")
- `translatedText: v.optional(v.string())` — translated comment text
- `replyOriginalContent: v.optional(v.string())` — original text before reply translation

**New files**:
- `packages/convex/convex/lib/translate.ts` — Google Translate API wrapper (`translateText`, `translateBatch`) + ISO 639-3→1 mapper
- `packages/convex/convex/lib/detectLanguage.ts` — shared helper that runs `franc` on comment docs and patches `detectedLanguage`
- `packages/convex/convex/translation.ts` — all translation actions/mutations:
  - `translateComment` — single comment translation
  - `translateBatchComments` — bulk translate all untranslated non-native comments
  - `translateReplyText` — translate message variations to multiple target languages
  - `backfillLanguageDetection` — migrate existing comments
  - Internal helpers: `patchLanguage`, `patchTranslation`, `detectLanguagesBatch`

**Modified files**:
- `packages/convex/convex/comments.ts` — inline language detection in `addBatch`, new fields in query return objects, `replyOriginalContent` in update mutation
- `packages/convex/convex/commenters.ts` — new fields in query return objects
- `packages/convex/convex/users.ts` — `features: { translation: isAllowed }` in `getAccessStatus`
- `packages/convex/package.json` — added `franc-min` dependency

**Design decision**: Language detection runs inline in the `addBatch` mutation (not scheduled via `scheduler.runAfter`) because `convex-test` doesn't support scheduled functions properly. This is synchronous within the transaction.

### Phase 2: Shared Types

**`packages/shared/src/types.ts`** — added to `ScrapedComment`:
- `detectedLanguage?: string`
- `translatedText?: string`
- `replyOriginalContent?: string`
- `messageToSend?: string` — transient field for per-comment translated reply during bulk send (not persisted)

### Phase 3: Dashboard Hook & Wiring

**New file**: `apps/web/src/hooks/useTranslation.ts`
- Manages `showTranslated` toggle state, `translatingIds` loading set, `translateAllInProgress` flag
- Exposes `translateComment(commentId)` and `translateAll()` via `useAction`
- Derives `targetLanguage` from `navigator.language`

**`apps/web/src/components/DashboardContent.tsx`**:
- Queries `getAccessStatus` for `features.translation`
- Calls `useTranslation(translationEnabled)`
- Passes translation props to `CommentTable`, `CommenterTable`, `ReplyComposer`

### Phase 4: Comment UI

**`CommentCard.tsx`**:
- Shows `translatedText` or original `comment` based on local toggle
- "Show original" / "Show translation" toggle link when translation exists
- "Translate" button with Languages icon and loading spinner for untranslated non-native comments

**`CommentTable.tsx`** and **`CommenterTable.tsx`**:
- "Show translations" checkbox in sticky header (global toggle)
- "Translate All" button with Languages icon and spinner
- Passes translation props through to child cards

**`CommenterCard.tsx`**:
- Passes translation props through to child `CommentCard` instances

**`CompactCommentCard.tsx`**:
- Shows `translatedText` when `showTranslated` is true

### Phase 5: Reply Translation

**`ReplyComposer.tsx`**:
- "Respond in commenter's language" checkbox (only shown when `translationEnabled`)
- `onSend` signature includes `respondInNativeLanguage` flag

**`DashboardContent.tsx`**:
- `executeBulkReply` async helper: collects unique non-English languages from selected comments, calls `translateReplyText` action, attaches `messageToSend` and `replyOriginalContent` to each comment
- `replyTranslationsRef` maps commentId → original message text for Convex updates on reply completion
- `handleReplyComplete` stores `replyOriginalContent` when available
- Missing-comment-choice modal flow passes `respondInNativeLanguage` through

**`useMessaging.ts`**:
- Includes `messageToSend` and `replyOriginalContent` in trimmed comments sent to extension

**`useCommentData.ts`**:
- `updateComment` maps `replyOriginalContent` to Convex updates

**`apps/extension/src/background/index.ts`**:
- Uses `comment.messageToSend` (if present) instead of cycling through message variations
- Stores `replyOriginalContent` in local storage after successful reply

---

## Files Summary

| File | Type | Changes |
|------|------|---------|
| `packages/convex/package.json` | Modified | Added `franc-min` |
| `packages/convex/convex/schema.ts` | Modified | +3 fields on comments |
| `packages/convex/convex/lib/translate.ts` | **New** | Google Translate wrapper + ISO mapping |
| `packages/convex/convex/lib/detectLanguage.ts` | **New** | Shared franc detection helper |
| `packages/convex/convex/translation.ts` | **New** | All translation actions/mutations |
| `packages/convex/convex/comments.ts` | Modified | Inline detection, return new fields, accept `replyOriginalContent` |
| `packages/convex/convex/commenters.ts` | Modified | Return new fields |
| `packages/convex/convex/users.ts` | Modified | `features.translation` in getAccessStatus |
| `packages/convex/convex/_generated/api.d.ts` | Modified | Added translation module |
| `packages/shared/src/types.ts` | Modified | +4 fields on ScrapedComment |
| `apps/web/src/hooks/useTranslation.ts` | **New** | Translation state + actions hook |
| `apps/web/src/hooks/useCommentData.ts` | Modified | `replyOriginalContent` in updateComment |
| `apps/web/src/hooks/useMessaging.ts` | Modified | `messageToSend` + `replyOriginalContent` in trimmed comments |
| `apps/web/src/components/DashboardContent.tsx` | Modified | Feature gate, translation hook, reply translation flow |
| `apps/web/src/components/CommentCard.tsx` | Modified | Translate button, text toggle |
| `apps/web/src/components/CommentTable.tsx` | Modified | Global toggle, Translate All, pass props |
| `apps/web/src/components/CommenterTable.tsx` | Modified | Global toggle, Translate All, pass props |
| `apps/web/src/components/CommenterCard.tsx` | Modified | Pass translation props to children |
| `apps/web/src/components/CompactCommentCard.tsx` | Modified | Show translated text |
| `apps/web/src/components/ReplyComposer.tsx` | Modified | "Respond in commenter's language" checkbox |
| `apps/extension/src/background/index.ts` | Modified | Use `messageToSend`, store `replyOriginalContent` |

---

## Phase 6: Migration & Verification

### 6.1 Environment Setup

Set the Google Translate API key in Convex:

```bash
# Dev
npx convex env set GOOGLE_TRANSLATE_API_KEY "your-api-key-here"

# Prod
npx convex env set GOOGLE_TRANSLATE_API_KEY "your-api-key-here" --prod
```

To get a key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Cloud Translation API**
3. Create an API key (restrict to Cloud Translation API)

### 6.2 Install Dependencies

```bash
cd packages/convex && npm install
```

This installs `franc-min` which was added to `package.json` in Phase 1.

### 6.3 Deploy Schema + Functions

```bash
npx convex deploy
```

This pushes the new schema fields and translation module to Convex.

### 6.4 Backfill Existing Comments

Run the backfill action for each user to detect languages on existing comments:

```bash
# From the Convex dashboard or via CLI
npx convex run translation:backfillLanguageDetection '{"clerkId": "user_xxx"}'
```

### 6.5 Verification Checklist

1. **Language detection**: Scrape new comments → verify `detectedLanguage` appears on non-English comments (runs inline in addBatch)
2. **Translate button**: Non-English comment shows "Translate" button → click → spinner → translated text appears → "Show original" toggle works
3. **Global toggle**: "Show translations" checkbox switches all translated comments between original/translated
4. **Translate All**: Click → spinner → translations appear progressively → button returns to normal
5. **Reply translation**: Select non-English comments → check "Respond in commenter's language" → type English reply → send → verify TikTok receives translated text → verify `replyOriginalContent` stored in Convex
6. **Feature gating**: Non-whitelisted user sees zero translation UI elements
7. **Edge cases**: Very short comments (< 10 chars) → no `detectedLanguage`. Comments already in user's language → no Translate button.
