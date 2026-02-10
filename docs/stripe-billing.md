# Stripe Subscription Billing

## Overview

Tokative uses a 3-tier subscription model with Stripe for payment processing.

| Tier | Monthly | Annual (~20% off) | Comment Limit | Translation |
|------|---------|--------------------|---------------|-------------|
| Free | $0 | — | 200/month | No |
| Pro | $19/mo | $182/yr ($15.17/mo) | 2,000/month | Yes |
| Premium | $49/mo | $470/yr ($39.17/mo) | 10,000/month | Yes |

Users on the free tier who need more can upgrade from the `/pricing` page or the Settings tab. Users needing limits above Premium can contact us for a custom plan.

Whitelisted emails (in `constants.ts`) are treated as Premium during the beta transition period.

## Architecture

### Backend (Convex)

- **`plans.ts`** — Plan limits, Stripe price ID constants, and `PRICE_ID_TO_PLAN` reverse lookup
- **`stripe.ts`** — `"use node"` file with three actions:
  - `createCheckoutSession` — Creates a Stripe Checkout session for subscribing
  - `createPortalSession` — Creates a Stripe Customer Portal session for managing subscriptions
  - `handleWebhook` — Processes Stripe webhook events to sync subscription state
- **`stripeHelpers.ts`** — Internal queries/mutations used by the actions (Convex `"use node"` files can only export actions)
- **`comments.ts`** — `addBatch` enforces monthly comment limits with lazy reset at month boundary
- **`users.ts`** — `getAccessStatus` returns subscription info and effective plan
- **`http.ts`** — `POST /api/stripe/webhook` endpoint for Stripe events
- **`schema.ts`** — Subscription fields on the `users` table

### Web App (Next.js)

- **`/api/stripe/checkout`** — Authenticated POST route, calls `createCheckoutSession` action
- **`/api/stripe/portal`** — Authenticated POST route, calls `createPortalSession` action
- **`/pricing`** — Public pricing page with monthly/annual toggle
- **`/account`** — Authenticated page showing plan, usage bar, and manage/upgrade buttons
- **Dashboard** — Detects `?checkout=success` query param and shows confirmation toast; shows limit banner when usage is at 80%+ or 100%

### Extension

- **`ConvexSyncResult`** — Extended with `limitReached`, `monthlyLimit`, `currentCount`, `plan`
- **`CommentLimitError`** — Thrown by `addScrapedComments` when the monthly limit is hit
- **`video-scraper.ts`** — Catches `CommentLimitError` in the scroll loop to stop scraping
- **`overlay.ts`** — `updateOverlayLimitReached()` shows limit message with upgrade link

## Stripe Dashboard Setup

### 1. Create Products and Prices

In [Stripe Dashboard → Products](https://dashboard.stripe.com/products):

1. Create a product called **"Pro"**
   - Add a recurring price: **$19/month**
   - Add a recurring price: **$182/year** (≈$15.17/mo, ~20% discount)
2. Create a product called **"Premium"**
   - Add a recurring price: **$49/month**
   - Add a recurring price: **$470/year** (≈$39.17/mo, ~20% discount)

Copy the 4 price IDs (they look like `price_1Abc...`) and update the constants in `packages/convex/convex/plans.ts`:

```ts
export const STRIPE_PRICE_IDS = {
  pro: {
    month: "price_...",  // Pro monthly
    year: "price_...",   // Pro annual
  },
  premium: {
    month: "price_...",  // Premium monthly
    year: "price_...",   // Premium annual
  },
} as const;
```

### 2. Enable Customer Portal

In [Stripe Dashboard → Settings → Billing → Customer portal](https://dashboard.stripe.com/settings/billing/portal):

- Enable **Cancel subscription**
- Enable **Switch plans** (add both Pro and Premium products)
- Enable **Update payment method**
- Set a return URL (this is overridden in code, but Stripe requires one)

### 3. Create Webhook Endpoint

In [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks):

1. Click **Add endpoint**
2. Set the URL to: `{CONVEX_SITE_URL}/api/stripe/webhook`
   - Find your Convex site URL with `npx convex url --prod` (e.g. `https://befitting-albatross-157.convex.site`)
3. Subscribe to these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing secret** (starts with `whsec_`)

### 4. Set Environment Variables

Set in Convex:

```bash
npx convex env set STRIPE_SECRET_KEY sk_live_...
npx convex env set STRIPE_WEBHOOK_SECRET whsec_...
npx convex env set DASHBOARD_URL https://your-domain.com
```

For local development, use test mode keys:

```bash
npx convex env set STRIPE_SECRET_KEY sk_test_...
npx convex env set STRIPE_WEBHOOK_SECRET whsec_...
npx convex env set DASHBOARD_URL http://localhost:3000
```

No Stripe-related env vars are needed in `.env.local` — the price IDs are constants in code.

## How It Works

### Checkout Flow

1. User clicks "Subscribe" on `/pricing`
2. Client POSTs to `/api/stripe/checkout` with the price ID
3. API route calls `createCheckoutSession` Convex action
4. Action creates/retrieves Stripe customer, creates Checkout Session
5. User is redirected to Stripe-hosted checkout page
6. On success, Stripe redirects to `/dashboard?checkout=success`
7. Stripe sends `customer.subscription.created` webhook → updates user doc
8. Dashboard shows success toast; subscription fields update reactively via `useQuery`

### Limit Enforcement

1. `addBatch` reads user's `subscriptionPlan` (defaults to `"free"`)
2. Lazy monthly reset: if `monthlyCommentResetAt` is before current month start, resets count to 0
3. If at/over limit, returns `{ limitReached: true }` immediately
4. Otherwise, caps the batch to the remaining monthly budget
5. After inserting, updates `monthlyCommentCount` on the user doc
6. Convex OCC (optimistic concurrency control) ensures concurrent batches are safe

### Extension Behavior

When `addScrapedComments` gets `limitReached: true` back from the API:

1. Throws `CommentLimitError`
2. The scroll loop in `video-scraper.ts` catches it and breaks with `exitReason = "comment_limit_reached"`
3. The overlay shows "Monthly comment limit reached (X/Y). Upgrade to collect more." with a link to `/pricing`

### Subscription Management

- "Manage Subscription" button in Settings → opens Stripe Customer Portal
- Portal handles: cancellation, plan switching, payment method updates
- On changes, Stripe sends webhooks → `handleWebhook` updates user doc
- On cancellation, user reverts to free plan

## Local Testing

### Stripe CLI

Forward webhook events to your local Convex dev deployment:

```bash
stripe listen --forward-to https://your-dev.convex.site/api/stripe/webhook
```

The CLI will print a webhook signing secret — set it as `STRIPE_WEBHOOK_SECRET` in your Convex dev environment.

### Test Cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

Use any future expiry date and any 3-digit CVC.

### Verification Checklist

- [ ] `npx convex dev` deploys without errors
- [ ] Pricing page renders with correct prices for monthly/annual
- [ ] Click Subscribe → redirected to Stripe Checkout
- [ ] Complete checkout → redirected to dashboard with success toast
- [ ] User doc has `subscriptionPlan`, `subscriptionStatus`, etc. populated
- [ ] Settings tab shows correct plan, usage bar, and "Manage Subscription" button
- [ ] Free tier: collect >200 comments → extension stops with limit overlay
- [ ] Pro tier: limit is 2,000; Premium: 10,000
- [ ] "Manage Subscription" → Stripe Customer Portal opens
- [ ] Cancel in portal → user reverts to free plan
- [ ] Free user sees no translate buttons; Pro/Premium can translate
- [ ] Manually set `monthlyCommentResetAt` to last month → count resets on next `addBatch`

## Schema Reference

Fields added to the `users` table:

| Field | Type | Description |
|-------|------|-------------|
| `stripeCustomerId` | `string?` | Stripe customer ID |
| `subscriptionPlan` | `"free" \| "pro" \| "premium"?` | Current plan (defaults to `"free"`) |
| `subscriptionStatus` | `"active" \| "past_due" \| "canceled" \| "incomplete"?` | Subscription status |
| `stripeSubscriptionId` | `string?` | Stripe subscription ID |
| `subscriptionPriceId` | `string?` | Active Stripe price ID |
| `subscriptionInterval` | `"month" \| "year"?` | Billing interval |
| `currentPeriodEnd` | `number?` | End of current billing period (ms timestamp) |
| `monthlyCommentCount` | `number?` | Comments collected this month |
| `monthlyCommentResetAt` | `number?` | When the monthly count was last reset (ms timestamp) |

Index: `by_stripe_customer_id` on `["stripeCustomerId"]`

All fields are optional — no migration needed for existing users.
