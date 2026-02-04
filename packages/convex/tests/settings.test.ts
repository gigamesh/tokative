import { describe, it, beforeEach } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestContext, createTestUser, expect } from "./helpers";

describe("settings", () => {
  let t: ReturnType<typeof createTestContext>;
  let clerkId: string;

  beforeEach(async () => {
    t = createTestContext();
    clerkId = `test-${Date.now()}-${Math.random()}`;
    await createTestUser(t, clerkId);
  });

  describe("get", () => {
    it("returns defaults for user with no settings", async () => {
      const settings = await t.query(api.settings.get, { clerkId });

      expect(settings).toEqual({
        messageDelay: 2000,
        scrollDelay: 1000,
        commentLimit: 100,
        postLimit: 50,
        accountHandle: null,
        hasCompletedSetup: false,
        hideOwnReplies: false,
        deleteMissingComments: null,
      });
    });

    it("returns saved settings", async () => {
      await t.mutation(api.settings.update, {
        clerkId,
        settings: { commentLimit: 200 },
      });

      const settings = await t.query(api.settings.get, { clerkId });
      expect(settings.commentLimit).toBe(200);
      expect(settings.messageDelay).toBe(2000); // Still default
    });
  });

  describe("update", () => {
    it("creates settings if none exist", async () => {
      await t.mutation(api.settings.update, {
        clerkId,
        settings: {
          messageDelay: 3000,
          scrollDelay: 2000,
        },
      });

      const settings = await t.query(api.settings.get, { clerkId });
      expect(settings.messageDelay).toBe(3000);
      expect(settings.scrollDelay).toBe(2000);
    });

    it("updates existing settings", async () => {
      await t.mutation(api.settings.update, {
        clerkId,
        settings: { postLimit: 100 },
      });

      await t.mutation(api.settings.update, {
        clerkId,
        settings: { postLimit: 75 },
      });

      const settings = await t.query(api.settings.get, { clerkId });
      expect(settings.postLimit).toBe(75);
    });

    it("partial updates preserve other fields", async () => {
      await t.mutation(api.settings.update, {
        clerkId,
        settings: {
          messageDelay: 5000,
          commentLimit: 150,
        },
      });

      await t.mutation(api.settings.update, {
        clerkId,
        settings: { commentLimit: 200 },
      });

      const settings = await t.query(api.settings.get, { clerkId });
      expect(settings.messageDelay).toBe(5000);
      expect(settings.commentLimit).toBe(200);
    });
  });
});
