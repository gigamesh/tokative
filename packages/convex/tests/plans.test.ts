import { describe, it, expect } from "vitest";
import {
  getMonthlyLimit,
  hasTranslation,
  getCurrentMonthStart,
  PLAN_LIMITS,
  priceIdToPlanName,
  getStripePriceIds,
} from "../convex/plans";

describe("plans", () => {
  describe("getMonthlyLimit", () => {
    it("returns 500 for free", () => {
      expect(getMonthlyLimit("free")).toBe(500);
    });

    it("returns 2500 for pro", () => {
      expect(getMonthlyLimit("pro")).toBe(2_500);
    });

    it("returns 25000 for premium", () => {
      expect(getMonthlyLimit("premium")).toBe(25_000);
    });
  });

  describe("hasTranslation", () => {
    it("returns false for free", () => {
      expect(hasTranslation("free")).toBe(false);
    });

    it("returns true for pro", () => {
      expect(hasTranslation("pro")).toBe(true);
    });

    it("returns true for premium", () => {
      expect(hasTranslation("premium")).toBe(true);
    });
  });

  describe("getCurrentMonthStart", () => {
    it("returns a timestamp at midnight UTC on the 1st", () => {
      const start = getCurrentMonthStart();
      const date = new Date(start);
      expect(date.getUTCDate()).toBe(1);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
      expect(date.getUTCMilliseconds()).toBe(0);
    });

    it("is in the current month", () => {
      const start = getCurrentMonthStart();
      const date = new Date(start);
      const now = new Date();
      expect(date.getUTCMonth()).toBe(now.getUTCMonth());
      expect(date.getUTCFullYear()).toBe(now.getUTCFullYear());
    });
  });

  describe("priceIdToPlanName", () => {
    it("maps live pro price IDs to pro", () => {
      const live = getStripePriceIds("sk_live_test");
      expect(priceIdToPlanName(live.pro.month)).toBe("pro");
      expect(priceIdToPlanName(live.pro.year)).toBe("pro");
    });

    it("maps test pro price IDs to pro", () => {
      const test = getStripePriceIds("sk_test_test");
      expect(priceIdToPlanName(test.pro.month)).toBe("pro");
      expect(priceIdToPlanName(test.pro.year)).toBe("pro");
    });

    it("maps live premium price IDs to premium", () => {
      const live = getStripePriceIds("sk_live_test");
      expect(priceIdToPlanName(live.premium.month)).toBe("premium");
      expect(priceIdToPlanName(live.premium.year)).toBe("premium");
    });

    it("maps test premium price IDs to premium", () => {
      const test = getStripePriceIds("sk_test_test");
      expect(priceIdToPlanName(test.premium.month)).toBe("premium");
      expect(priceIdToPlanName(test.premium.year)).toBe("premium");
    });

    it("returns free for unknown price ID", () => {
      expect(priceIdToPlanName("price_unknown")).toBe("free");
    });
  });

  describe("getStripePriceIds", () => {
    it("returns test IDs for sk_test_ keys", () => {
      const test = getStripePriceIds("sk_test_abc123");
      const live = getStripePriceIds("sk_live_abc123");
      expect(test.pro.month).not.toBe(live.pro.month);
    });
  });

  describe("PLAN_LIMITS", () => {
    it("has entries for all three plans", () => {
      expect(Object.keys(PLAN_LIMITS)).toEqual(["free", "pro", "premium"]);
    });

    it("limits increase from free → pro → premium", () => {
      expect(PLAN_LIMITS.free.monthlyComments).toBeLessThan(PLAN_LIMITS.pro.monthlyComments);
      expect(PLAN_LIMITS.pro.monthlyComments).toBeLessThan(PLAN_LIMITS.premium.monthlyComments);
    });
  });
});
