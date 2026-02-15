import { describe, it, beforeEach } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestContext, createTestUser, expect } from "./helpers";
import { Id } from "../convex/_generated/dataModel";

describe("referrals", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  describe("getOrCreateReferralCode", () => {
    it("generates a code on first call", async () => {
      const clerkId = await createTestUser(t);
      const code = await t.mutation(api.referrals.getOrCreateReferralCode, {
        clerkId,
      });

      expect(code).toMatch(/^TOK-[a-z2-9]{8}$/);
    });

    it("returns the same code on subsequent calls", async () => {
      const clerkId = await createTestUser(t);
      const code1 = await t.mutation(api.referrals.getOrCreateReferralCode, {
        clerkId,
      });
      const code2 = await t.mutation(api.referrals.getOrCreateReferralCode, {
        clerkId,
      });

      expect(code1).toEqual(code2);
    });

    it("generates unique codes for different users", async () => {
      const clerkId1 = await createTestUser(t, "user-1");
      const clerkId2 = await createTestUser(t, "user-2");

      const code1 = await t.mutation(api.referrals.getOrCreateReferralCode, {
        clerkId: clerkId1,
      });
      const code2 = await t.mutation(api.referrals.getOrCreateReferralCode, {
        clerkId: clerkId2,
      });

      expect(code1).not.toEqual(code2);
    });
  });

  describe("getReferralStats", () => {
    it("returns null stats before code generation", async () => {
      const clerkId = await createTestUser(t);
      const stats = await t.query(api.referrals.getReferralStats, { clerkId });

      expect(stats).toMatchObject({
        referralCode: null,
        pending: 0,
        qualified: 0,
      });
    });

    it("returns code after generation", async () => {
      const clerkId = await createTestUser(t);
      const code = await t.mutation(api.referrals.getOrCreateReferralCode, {
        clerkId,
      });
      const stats = await t.query(api.referrals.getReferralStats, { clerkId });

      expect(stats!.referralCode).toEqual(code);
    });
  });

  describe("applyReferralCode", () => {
    it("links a referred user to the referrer", async () => {
      const referrerClerkId = await createTestUser(t, "referrer");
      const referredClerkId = await createTestUser(t, "referred");

      const code = await t.mutation(api.referrals.getOrCreateReferralCode, {
        clerkId: referrerClerkId,
      });

      const result = await t.mutation(api.referrals.applyReferralCode, {
        referredClerkId,
        referralCode: code,
      });

      expect(result).toMatchObject({ applied: true });

      const stats = await t.query(api.referrals.getReferralStats, {
        clerkId: referrerClerkId,
      });
      expect(stats!.pending).toBe(1);
    });

    it("rejects self-referral", async () => {
      const clerkId = await createTestUser(t);
      const code = await t.mutation(api.referrals.getOrCreateReferralCode, {
        clerkId,
      });

      const result = await t.mutation(api.referrals.applyReferralCode, {
        referredClerkId: clerkId,
        referralCode: code,
      });

      expect(result).toMatchObject({ applied: false, reason: "self_referral" });
    });

    it("rejects invalid referral code", async () => {
      const referredClerkId = await createTestUser(t, "referred");

      const result = await t.mutation(api.referrals.applyReferralCode, {
        referredClerkId,
        referralCode: "TOK-nonexist",
      });

      expect(result).toMatchObject({ applied: false, reason: "invalid_code" });
    });

    it("rejects duplicate referral", async () => {
      const referrerClerkId = await createTestUser(t, "referrer");
      const referredClerkId = await createTestUser(t, "referred");

      const code = await t.mutation(api.referrals.getOrCreateReferralCode, {
        clerkId: referrerClerkId,
      });

      await t.mutation(api.referrals.applyReferralCode, {
        referredClerkId,
        referralCode: code,
      });

      const result = await t.mutation(api.referrals.applyReferralCode, {
        referredClerkId,
        referralCode: code,
      });

      expect(result).toMatchObject({
        applied: false,
        reason: "already_referred",
      });
    });

    it("rejects when same normalized email", async () => {
      const referrerClerkId = "referrer-email";
      const referredClerkId = "referred-email";

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: referrerClerkId,
          email: "john.doe@gmail.com",
          createdAt: Date.now(),
        });
        await ctx.db.insert("users", {
          clerkId: referredClerkId,
          email: "johndoe+alt@gmail.com",
          createdAt: Date.now(),
        });
      });

      const code = await t.mutation(api.referrals.getOrCreateReferralCode, {
        clerkId: referrerClerkId,
      });

      const result = await t.mutation(api.referrals.applyReferralCode, {
        referredClerkId,
        referralCode: code,
      });

      expect(result).toMatchObject({ applied: false, reason: "same_email" });
    });
  });

  describe("qualifyReferral", () => {
    it("qualifies when referred user is still active on paid plan", async () => {
      const referrerClerkId = "referrer-qual";
      const referredClerkId = "referred-qual";

      let referralId: Id<"referrals"> | undefined;

      await t.run(async (ctx) => {
        const referrerId = await ctx.db.insert("users", {
          clerkId: referrerClerkId,
          createdAt: Date.now(),
          subscriptionPlan: "pro",
          subscriptionStatus: "active",
          stripeSubscriptionId: "sub_test_referrer",
        });
        const referredId = await ctx.db.insert("users", {
          clerkId: referredClerkId,
          createdAt: Date.now(),
          referredByUserId: referrerId,
          subscriptionPlan: "pro",
          subscriptionStatus: "active",
          stripeSubscriptionId: "sub_test_referred",
        });
        referralId = await ctx.db.insert("referrals", {
          referrerId,
          referredId,
          status: "pending",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        const referral = await ctx.db.get(referralId!);
        expect(referral!.status).toBe("pending");
      });

      // qualifyReferral is an internalMutation — run it directly
      const { internal } = await import("../convex/_generated/api");
      await t.mutation(internal.referrals.qualifyReferral, {
        referralId: referralId!,
      });

      await t.run(async (ctx) => {
        const referral = await ctx.db.get(referralId!);
        expect(referral!.status).toBe("qualified");
        expect(referral!.qualifiedAt).toBeDefined();
      });
    });

    it("does not qualify when referred user canceled", async () => {
      let referralId: Id<"referrals"> | undefined;

      await t.run(async (ctx) => {
        const referrerId = await ctx.db.insert("users", {
          clerkId: "referrer-cancel",
          createdAt: Date.now(),
        });
        const referredId = await ctx.db.insert("users", {
          clerkId: "referred-cancel",
          createdAt: Date.now(),
          referredByUserId: referrerId,
          subscriptionPlan: "free",
          subscriptionStatus: "canceled",
        });
        referralId = await ctx.db.insert("referrals", {
          referrerId,
          referredId,
          status: "pending",
          createdAt: Date.now(),
        });
      });

      const { internal } = await import("../convex/_generated/api");
      await t.mutation(internal.referrals.qualifyReferral, {
        referralId: referralId!,
      });

      await t.run(async (ctx) => {
        const referral = await ctx.db.get(referralId!);
        expect(referral!.status).toBe("pending");
      });
    });

});
});
