# Language Translation Feature for Tokative

## Feature Overview

Add language detection for stored comments and translation capability for replies:
1. **Background process** detects the language of every stored comment
2. **UI** shows detected language and offers translation option
3. **Reply flow** translates user's reply into the comment's language before sending

---

## Current Architecture

**App Type**: Chrome Extension + Next.js Web Dashboard (monorepo)

**Key Files**:
- `packages/shared/src/types.ts` - `ScrapedComment` interface (no language field currently)
- `apps/extension/src/utils/storage.ts` - Chrome storage layer
- `apps/web/src/components/MessageComposer.tsx` - Reply composition UI
- `apps/extension/src/content/tiktok/comment-replier.ts` - Sends replies to TikTok
- `apps/extension/src/background/index.ts` - Background service worker

**Reply Data Flow**:
```
MessageComposer → useMessaging hook → Extension Bridge → Background Worker → Content Script → TikTok
```

---

## Language Detection: franc (Recommended)

### Why franc?
- **Completely free** - no API costs, no limits
- **Offline** - works entirely in the extension, no network calls
- **Fast** - instant detection, no latency
- **Lightweight** - 180KB-2MB depending on language coverage

### How It Works

franc uses **n-gram frequency matching**:

1. **N-grams**: Breaks text into overlapping character sequences (trigrams).
   - Example: "hello" → `"hel"`, `"ell"`, `"llo"`

2. **Language profiles**: Pre-computed frequency profiles for each language.
   - English: common trigrams like `"the"`, `"ing"`, `"tion"`
   - Japanese: `"です"`, `"ます"`, etc.

3. **Matching**: Compares input text's n-gram frequencies against all profiles, returns closest match.

### Usage

```javascript
import { franc } from 'franc';

franc('Hello, how are you?');          // 'eng'
franc('Bonjour, comment allez-vous?'); // 'fra'
franc('こんにちは');                     // 'jpn'
franc('Hola, ¿cómo estás?');           // 'spa'

// Returns ISO 639-3 codes (3-letter)
// Returns 'und' (undetermined) if detection fails
```

### Package Options

| Package | Languages | Size | Use Case |
|---------|-----------|------|----------|
| `franc-min` | 82 (8M+ speakers) | ~180KB | **Recommended** - covers 99% of TikTok comments |
| `franc` | 187 (1M+ speakers) | ~480KB | More coverage if needed |
| `franc-all` | 414 | ~2MB | Maximum coverage |

### Limitations

- **Short text**: Needs ~20+ characters for reliable detection
- **Mixed language**: Returns best guess, doesn't handle code-switching
- **Similar languages**: May confuse Norwegian/Danish/Swedish or Spanish/Portuguese

---

## Translation API Comparison

### Pricing Summary

| Provider | Cost per 1M chars | Free Tier | Languages |
|----------|-------------------|-----------|-----------|
| [Microsoft Azure](https://azure.microsoft.com/en-us/pricing/details/translator/) | **$10** | 2M chars/mo (12 months) | 135+ |
| [Amazon Translate](https://aws.amazon.com/translate/pricing/) | $15 | 2M chars/mo (12 months) | 75+ |
| [Google Cloud](https://cloud.google.com/translate/pricing) | $20 | 500K chars/mo (forever) | 130+ |
| [DeepL](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans) | $25 + $5.49/mo base | 500K chars/mo | 30+ |

### When to Choose Each

| Provider | Best For |
|----------|----------|
| **Google Cloud** | Getting started - free tier never expires |
| **Microsoft Azure** | High volume - cheapest per-character rate |
| **DeepL** | Quality-critical, especially European languages |
| **Amazon Translate** | Already using AWS ecosystem |

### Cost Estimates

Assuming typical usage: ~10,000 comments detected/month, ~1,000 replies translated (~50 chars each):

| Setup | Detection Cost | Translation Cost | Monthly Total |
|-------|---------------|------------------|---------------|
| franc + Google | $0 | $0 (within free tier) | **$0** |
| franc + Azure | $0 | ~$0.50 | ~$0.50 |
| franc + DeepL | $0 | $5.49 base + ~$1.25 | ~$6.74 |

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LANGUAGE DETECTION                        │
│                                                              │
│  New comments → franc (offline) → detectedLanguage stored   │
│                                                              │
│  Cost: $0 | Speed: Instant | Runs in: Extension             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TRANSLATION (on reply)                    │
│                                                              │
│  User's reply → Google/Azure/DeepL API → Translated text    │
│                                                              │
│  Cost: ~$0 (free tier) | Runs in: Background worker         │
└─────────────────────────────────────────────────────────────┘
```

**Key insight**: Use free offline detection for high-volume comment processing, only call paid translation API when user actually sends a reply (much lower volume).

---

## Implementation Plan

### Phase 1: Language Detection

1. Add `detectedLanguage?: string` field to `ScrapedComment` interface
2. Install `franc-min` package in extension
3. Detect language when comments are stored in `addScrapedComments()`
4. Store ISO 639-3 codes (convert to ISO 639-1 for API compatibility)

### Phase 2: UI Updates

1. Add language badge to `CommentCard` component
2. Add "Translate reply" toggle in `MessageComposer`
3. Show target language based on detected comment language

### Phase 3: Translation Integration

1. Add translation API configuration in settings
2. Create `translation.ts` service wrapper
3. Hook into reply flow (in `useMessaging` or background worker)
4. Translate before sending when toggle is enabled

### Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/types.ts` | Add `detectedLanguage` field |
| `apps/extension/src/utils/storage.ts` | Integrate franc detection on save |
| `apps/extension/src/background/index.ts` | Handle translation API calls |
| `apps/web/src/components/CommentCard.tsx` | Display language badge |
| `apps/web/src/components/MessageComposer.tsx` | Add translate toggle |
| `apps/web/src/hooks/useMessaging.ts` | Integrate translation before send |
| New: `apps/extension/src/utils/translation.ts` | Translation service wrapper |

---

## Verification

1. Store a comment in a non-English language → verify `detectedLanguage` is set
2. Open reply composer → verify detected language badge appears
3. Enable translation toggle, compose English reply → verify translated text
4. Send reply → verify translated content appears on TikTok
