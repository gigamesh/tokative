import { describe, it, beforeEach } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestContext, expect } from "./helpers";

describe("users", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  describe("getOrCreate", () => {
    it("creates new user", async () => {
      const clerkId = `new-user-${Date.now()}`;

      const userId = await t.mutation(api.users.getOrCreate, {
        clerkId,
      });

      expect(userId).toBeDefined();
    });

    it("returns existing user if already exists", async () => {
      const clerkId = `existing-user-${Date.now()}`;

      const userId1 = await t.mutation(api.users.getOrCreate, {
        clerkId,
      });

      const userId2 = await t.mutation(api.users.getOrCreate, {
        clerkId,
      });

      expect(userId1).toEqual(userId2);
    });
  });
});
