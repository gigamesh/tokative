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
