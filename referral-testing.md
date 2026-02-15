  Setup                                                                                                                                                                      
                                                                                                                                                                             
  1. Flip BILLING_ENABLED to true in plans.ts (locally, don't deploy)                                                                                                        
  2. Make sure STRIPE_SECRET_KEY is your sk_test_... key                       
  3. Run convex dev and next dev locally

  Flow 1: Happy path

  As the referrer (your main account):
  1. Open dashboard → Settings → click "Get your referral link"
  2. Copy the link (e.g. localhost:3000/r/TOK-a8f3x9kp)
  3. Verify in Convex dashboard that your user record now has referralCode set

  As the referred user (incognito window, different Clerk account):
  1. Visit the referral link — confirm you land on /?ref=TOK-a8f3x9kp
  2. Open DevTools → Application → Local Storage → confirm tokative_ref is set
  3. Sign up through Clerk
  4. After onboarding, check Convex dashboard:
    - Referred user's referredByUserId should point to the referrer
    - A referrals row should exist with status: "pending"
    - tokative_ref should be gone from localStorage
  5. Go to pricing → subscribe with card 4242 4242 4242 4242
  6. Check Convex dashboard → _scheduled_functions table — you should see qualifyReferral scheduled 7 days out

  Trigger qualification manually (don't wait 7 days):
  # In the Convex dashboard, find the referral ID, then run in the Functions tab:
  npx convex run referrals:qualifyReferral '{"referralId": "<the referral _id>"}'
  - Referral row should now be status: "qualified" with qualifiedAt set
  - Check _scheduled_functions for applyReferralCredit (runs immediately)
  - In Stripe dashboard → Customers → referrer → look for a $19 off coupon on their subscription's upcoming invoice

  Flow 2: Anti-exploitation

  - Self-referral: Try applying your own referral code — should return self_referral
  - Duplicate: Try the same referral link with an already-referred account — should return already_referred
  - Email normalization: Create two test accounts with testfoo@gmail.com and test.foo+alt@gmail.com — should return same_email

  Flow 3: Edge cases

  - Referred user cancels before 7 days: Subscribe, then cancel via Stripe portal. Manually trigger qualifyReferral — referral should stay pending (not qualify)
  - Referrer on free plan: Qualification still happens (row goes to qualified), but applyReferralCredit will no-op since there's no active subscription to apply the coupon
  to. That's fine — the credit is lost, which is acceptable since they aren't paying anyway

  What you can't locally test

  The webhook integration (subscription.created → scheduling) requires Stripe to hit your endpoint. You'd need either:
  - Stripe CLI: stripe listen --forward-to localhost:3000/api/stripe/webhook to forward test webhooks locally
  - Or just trust the unit tests + manually trigger qualification as shown above