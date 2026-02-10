  Recommended 3-Tier Structure

  The industry-standard approach for tools like this is usage-limited free tier + feature-gated paid tiers, where the free tier gives enough
  value to create habit/dependency, and upgrade triggers are hit naturally as usage grows.

  Free

  Goal: Let users experience the core loop (collect → view → reply) so they build it into their workflow.

  - Comment collection: 100 comments/month
  - Single-comment reply only (no bulk)
  - 3 video limit (stored at a time)
  - Dashboard access (search, sort, filter)
  - No translation / language detection
  - No profile video scraping
  - No ignore list

  Why this works: The 100-comment cap and single-reply limitation let users feel the value of collection + dashboard, but the moment they
  want to actually act on comments at scale, they hit the upgrade trigger. The video limit also creates natural friction for power users.

  Pro — ~$19/mo (or $15/mo annual)

  Goal: The workhorse tier for individual creators and small accounts.

  - Comment collection: 2,000 comments/month
  - Bulk reply with up to 3 message variations
  - 50 video storage
  - Profile video scraping
  - Ignore list filtering
  - Comment translation + language detection
  - Commenters aggregation tab
  - Priority support

  Why $19: SaaS creator tools in this space (Metricool, Flick, Later) cluster around $15–25/mo for individual plans. $19 is psychologically
  under $20 and leaves room for annual discount.

  Business — ~$49/mo (or $39/mo annual)

  Goal: For agencies, larger creators, or anyone managing high volume.

  - Unlimited comment collection
  - Bulk reply with unlimited message variations
  - Unlimited video storage
  - Everything in Pro
  - CSV/JSON export (not built yet, but natural upsell)
  - Future: multi-account support, team access, analytics

  Why this tier exists: Even if few users land here initially, it anchors the Pro price as reasonable and gives you room to add high-value
  features (export, multi-account, analytics) without restructuring.

  ---
  Key Principles Applied

  1. Value metric = comments collected. This is the natural unit of value — scales with how much the user benefits. Monthly caps create
  predictable upgrade triggers.
  2. Bulk reply is the paywall. Single reply on free, bulk on paid. This is the highest-value feature and the clearest "I need this" moment.
  3. Free tier creates dependency, not satisfaction. Users can't fully do their job on free, but they can't go back to doing it manually
  either. This is the retention hook.
  4. Annual discount for retention. ~20% off annual plans is standard. Reduces churn by locking in commitment.
  5. No feature removed on downgrade — just limited. If someone cancels Pro, their data stays, they just can't collect more past the free
  cap. This avoids resentment and keeps the door open for re-subscription.

  ---
  Implementation Consideration

  Right now the app has a whitelist system (whitelist.ts) gating translation. To support tiers, you'd extend this into a proper subscription
  check — likely a plan field on the user record (e.g. "free" | "pro" | "business") with Stripe or Lemon Squeezy handling billing and
  webhooks updating the plan field in Convex. The existing per-feature gating pattern (whitelist check → allow/deny) maps cleanly to
  plan-based checks.