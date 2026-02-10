import { describe, it, expect } from "vitest";
import {
  getMonthlyLimit,
  hasTranslation,
  getCurrentMonthStart,
  PLAN_LIMITS,
  PRICE_ID_TO_PLAN,
  STRIPE_PRICE_IDS,
} from "../convex/plans";

describe("plans", () => {
  describe("getMonthlyLimit", () => {
    it("returns 200 for free", () => {
      expect(getMonthlyLimit("free")).toBe(200);
    });

    it("returns 2000 for pro", () => {
      expect(getMonthlyLimit("pro")).toBe(2_000);
    });

    it("returns 10000 for premium", () => {
      expect(getMonthlyLimit("premium")).toBe(10_000);
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

  describe("PRICE_ID_TO_PLAN", () => {
    it("maps all pro price IDs to pro", () => {
      expect(PRICE_ID_TO_PLAN[STRIPE_PRICE_IDS.pro.month]).toBe("pro");
      expect(PRICE_ID_TO_PLAN[STRIPE_PRICE_IDS.pro.year]).toBe("pro");
    });

    it("maps all premium price IDs to premium", () => {
      expect(PRICE_ID_TO_PLAN[STRIPE_PRICE_IDS.premium.month]).toBe("premium");
      expect(PRICE_ID_TO_PLAN[STRIPE_PRICE_IDS.premium.year]).toBe("premium");
    });

    it("returns undefined for unknown price ID", () => {
      expect(PRICE_ID_TO_PLAN["price_unknown"]).toBeUndefined();
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
