  Setup

  1. Flip BILLING_ENABLED to true in plans.ts (locally, don't deploy)
  2. Make sure STRIPE_SECRET_KEY is your sk_test_... key
  3. Run convex dev and next dev locally

  Stripe setup for trial checkout

  No extra Stripe configuration is needed — trial_period_days is passed directly
  in the checkout session creation call. When a referred user clicks "Start Free
  Pro Trial" or "Start Free Premium Trial", Stripe creates a subscription with a
  7-day trial. The user enters payment info but isn't charged until the trial ends.

  To verify it's working, check the Stripe dashboard after checkout:
  - Customers → the test user → Subscriptions → status should be "trialing"
  - The subscription should show "Trial ends <date 7 days from now>"

  Flow 1: Happy path (referrer setup)

  As the referrer (your main account):
  1. Open dashboard → Settings → click "Get your referral link"
  2. Copy the link (e.g. localhost:3000/r/tok-a8f3x9kp)
  3. Verify in Convex dashboard that your user record now has referralCode set

  Flow 2: Referred user — unauthenticated

  1. Open incognito window → visit the referral link (e.g. localhost:3000/r/tok-a8f3x9kp)
  2. Confirm you see the landing page with Pro and Premium plan cards
  3. Open DevTools → Application → Local Storage → confirm tokative_ref is set
  4. Click either "Start Free Pro Trial" or "Start Free Premium Trial"
  5. You should be redirected to /sign-in (not Stripe) since you're not logged in
  6. Sign up through Clerk
  7. After onboarding, check Convex dashboard:
    - Referred user's referredByUserId should point to the referrer
    - A referrals row should exist with status: "pending"
    - tokative_ref should be gone from localStorage

  Flow 3: Referred user — authenticated checkout

  As the referred user (already signed in):
  1. Visit the referral link again (localhost:3000/r/tok-a8f3x9kp)
  2. Click "Start Free Pro Trial"
  3. You should be redirected to Stripe Checkout
  4. Confirm the checkout page shows "7-day free trial" and the Pro price ($19/mo)
  5. Use test card 4242 4242 4242 4242, any future expiry, any CVC
  6. Complete checkout → redirected to /dashboard?checkout=success
  7. Check Convex dashboard:
    - User's subscriptionStatus should be "active" (Stripe maps "trialing" → "active")
    - subscriptionPlan should be "pro"
  8. Check Stripe dashboard:
    - Customer subscription status should be "trialing"
    - Next invoice date should be 7 days from now
  9. Check Convex _scheduled_functions — qualifyReferral should be scheduled 7 days out

  Flow 4: Premium trial

  Repeat Flow 3 but click "Start Free Premium Trial" instead.
  Confirm Stripe checkout shows Premium pricing ($49/mo) with 7-day trial.

  Flow 5: No trial on regular checkout (backward compatibility)

  1. Visit /pricing directly (not through a referral link)
  2. Subscribe to Pro or Premium
  3. Confirm Stripe checkout does NOT show any trial period — charges immediately

  Trigger qualification manually (don't wait 7 days)

  # In the Convex dashboard, find the referral ID, then run in the Functions tab:
  npx convex run referrals:qualifyReferral '{"referralId": "<the referral _id>"}'
  - Referral row should now be status: "qualified" with qualifiedAt set
  - Check _scheduled_functions for applyReferralCredit (runs immediately)
  - In Stripe dashboard → Customers → referrer → look for a coupon on their subscription

  Flow 6: Anti-exploitation

  - Self-referral: Try applying your own referral code — should return self_referral
  - Duplicate: Try the same referral link with an already-referred account — should return already_referred
  - Email normalization: Create two test accounts with testfoo@gmail.com and test.foo+alt@gmail.com — should return same_email

  Flow 7: Edge cases

  - Referred user cancels before 7 days: Subscribe via trial, then cancel via Stripe portal. Manually trigger qualifyReferral — referral should stay pending (not qualify)
  - Referrer on free plan: Qualification still happens (row goes to qualified), but applyReferralCredit will no-op since there's no active subscription to apply the coupon
  to. That's fine — the credit is lost, which is acceptable since they aren't paying anyway

  What you can't locally test

  The webhook integration (subscription.created → scheduling) requires Stripe to hit your endpoint. You'd need either:
  - Stripe CLI: stripe listen --forward-to localhost:3000/api/stripe/webhook to forward test webhooks locally
  - Or just trust the unit tests + manually trigger qualification as shown above

  ---

  AFFILIATE SYSTEM TESTING

  Additional setup

  1. Set STRIPE_CONNECT_WEBHOOK_SECRET in your Convex environment variables
  2. If testing Connect webhooks locally, run a second Stripe CLI listener:
     stripe listen --forward-connect-to <CONVEX_SITE_URL>/api/stripe/connect-webhook
  3. Also add invoice.payment_succeeded and charge.refunded to your platform webhook
     (or forward them via the existing Stripe CLI listener)

  Flow A1: Admin creates an affiliate

  1. Sign in as the admin account (m.masurka@gmail.com)
  2. Visit /admin/affiliates
  3. Enter the email of an existing user and click "Add"
  4. Verify the affiliate appears in the table with connectStatus: "pending"
  5. In Convex dashboard, confirm an affiliates row exists with isWhitelisted: true
     and an aff-xxxxxxxx code

  Flow A2: Affiliate landing page — unauthenticated

  1. Copy the affiliate code from the admin table
  2. Open incognito → visit localhost:3000/a/aff-xxxxxxxx
  3. Confirm you see partnership-oriented copy (not "You've been invited")
  4. Open DevTools → Application → Local Storage → confirm tokative_aff is set
  5. Click "Get Started with Pro" → should redirect to /sign-in
  6. Sign up with a new test account
  7. After onboarding, check Convex dashboard:
     - New user's affiliatedByAffiliateId should point to the affiliate record
     - referredByUserId should be null (affiliate, not referral)
     - tokative_aff should be gone from localStorage

  Flow A3: Affiliate landing page — authenticated

  As a signed-in user (not already affiliated):
  1. Visit localhost:3000/a/aff-xxxxxxxx
  2. Click "Get Started with Pro"
  3. Should redirect to Stripe Checkout (no trial — regular pricing)
  4. Use test card 4242 4242 4242 4242
  5. Complete checkout → /dashboard?checkout=success
  6. Check that the user has affiliatedByAffiliateId set

  Flow A4: Query parameter capture

  1. Visit localhost:3000/pricing?aff=aff-xxxxxxxx
  2. Check localStorage → tokative_aff should be set
  3. Subscribe normally through pricing page
  4. After onboarding, the affiliate link should be applied

  Flow A5: Referral takes precedence over affiliate

  1. Set both localStorage values:
     - tokative_ref = tok-xxxxxxxx (a valid referral code)
     - tokative_aff = aff-xxxxxxxx (a valid affiliate code)
  2. Sign up a new user and go through onboarding
  3. Check Convex dashboard:
     - referredByUserId should be set (referral applied)
     - affiliatedByAffiliateId should be null (affiliate discarded)
     - Both localStorage keys should be cleared

  Flow A6: Commission creation via webhook

  This requires Stripe CLI forwarding or a deployed environment.
  1. Ensure the affiliated user has an active paid subscription
  2. In Stripe test mode, create an invoice for the customer:
     stripe invoices create --customer cus_xxx
     stripe invoices finalize --invoice inv_xxx
     stripe invoices pay inv_xxx
     OR just wait for the next billing cycle (use Stripe test clocks to fast-forward)
  3. Check Convex dashboard → affiliateCommissions table:
     - A "held" commission should exist
     - commissionCents should be floor(invoiceAmount * 3000 / 10000) = 30% of invoice
     - availableAt should be 60 days from creation
  4. Check _scheduled_functions → releaseCommission should be scheduled at availableAt

  Trigger commission release manually (don't wait 60 days)

  npx convex run affiliateHelpers:releaseCommission '{"commissionId": "<the commission _id>"}'
  - If affiliate is whitelisted and subscriber is still active:
    commission status should change to "available"
  - If Connect account is active, executeTransfer should be scheduled
  - If affiliate was deauthorized or subscriber canceled:
    commission status should change to "reversed"

  Flow A7: Stripe Connect onboarding

  1. Sign in as the affiliate user
  2. Visit /affiliate
  3. Verify stats cards show (all zeros initially), affiliate link is displayed
  4. Click "Set Up Payouts"
  5. Should redirect to Stripe Express onboarding flow
  6. Complete with test data (use Stripe test mode — any SSN like 000-00-0000)
  7. After returning to /affiliate/onboarding?success=1:
     - Should show "Verifying your account..."
     - After the account.updated webhook fires, connectStatus → "active"
     - Auto-redirects to /affiliate dashboard
  8. Verify "Payouts enabled" badge appears
  9. Click "View Stripe Dashboard" → should open Stripe Express dashboard in new tab

  Flow A8: Affiliate dashboard data

  After some commissions exist:
  1. Visit /affiliate as the affiliate user
  2. Verify stats cards: Total Earned, Held, Available, Subscribers
  3. Subscribers table should show each subscriber with plan, status, commission total
  4. Commission history should show each commission with date, invoice amount,
     commission amount, status, and release date

  Flow A9: Refund handling

  Refund during hold period:
  1. Find a "held" commission in the Convex dashboard
  2. In Stripe dashboard, refund the associated charge (full or partial)
  3. charge.refunded webhook fires → handleChargeRefunded runs
  4. For full refund: commission status → "reversed", commissionCents → 0
  5. For partial refund: commissionCents reduced proportionally

  Refund after transfer:
  1. Find a "transferred" commission
  2. Refund the charge in Stripe
  3. reverseTransfer action should run → creates a transfer reversal in Stripe
  4. Commission status → "reversed"

  Flow A10: Deauthorize affiliate

  1. As admin, visit /admin/affiliates
  2. Toggle the whitelist switch off for an affiliate
  3. Verify isWhitelisted is now false in Convex
  4. Any held commissions for this affiliate should be reversed when releaseCommission runs
  5. The affiliate's link should stop working (applyAffiliateCode returns invalid_code)

  Flow A11: Anti-exploitation

  - Self-affiliate: Sign in as the affiliate, visit their own link → should return self_affiliate
  - Already affiliated: Try applying an affiliate code to an already-affiliated user → already_affiliated
  - Has referral: Try applying affiliate code to a user with referredByUserId set → has_referral
  - Email normalization: Same as referral — testfoo@gmail.com and test.foo+alt@gmail.com → same_email
  - Invalid/deauthorized code: Try a code for a deauthorized affiliate → invalid_code

  Flow A12: Affiliate terms page

  1. Visit localhost:3000/affiliate-terms (unauthenticated)
  2. Should render without auth (public route)
  3. Verify all 11 sections are present and reference correct terms (30%, 60-day hold, etc.)

  What you can't locally test without Stripe CLI

  - invoice.payment_succeeded → commission creation (needs real webhook)
  - charge.refunded → commission reversal (needs real webhook)
  - account.updated → Connect status changes (needs Connect webhook forwarding)
  - stripe.transfers.create → actual payout (test mode creates test transfers)

  Use Stripe CLI to forward both platform and Connect webhooks:
    stripe listen --forward-to <CONVEX_SITE_URL>/api/stripe/webhook \
                  --forward-connect-to <CONVEX_SITE_URL>/api/stripe/connect-webhook
