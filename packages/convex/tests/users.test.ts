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
        email: "test@example.com",
      });

      expect(userId).toBeDefined();

      const user = await t.query(api.users.getByClerkId, { clerkId });
      expect(user).not.toBeNull();
      expect(user?.email).toBe("test@example.com");
    });

    it("returns existing user if already exists", async () => {
      const clerkId = `existing-user-${Date.now()}`;

      const userId1 = await t.mutation(api.users.getOrCreate, {
        clerkId,
        email: "first@example.com",
      });

      const userId2 = await t.mutation(api.users.getOrCreate, {
        clerkId,
        email: "second@example.com",
      });

      expect(userId1).toEqual(userId2);

      const user = await t.query(api.users.getByClerkId, { clerkId });
      expect(user?.email).toBe("first@example.com"); // Original email preserved
    });
  });

  describe("getByClerkId", () => {
    it("returns null for non-existent user", async () => {
      const user = await t.query(api.users.getByClerkId, {
        clerkId: "nonexistent",
      });
      expect(user).toBeNull();
    });

    it("returns user by clerk id", async () => {
      const clerkId = `find-user-${Date.now()}`;
      await t.mutation(api.users.getOrCreate, { clerkId });

      const user = await t.query(api.users.getByClerkId, { clerkId });
      expect(user).not.toBeNull();
      expect(user?.clerkId).toBe(clerkId);
    });
  });

});
