import { describe, it, beforeEach } from "vitest";
import { api } from "../convex/_generated/api";
import { createTestContext, createTestUser, expect } from "./helpers";

describe("ignoreList", () => {
  let t: ReturnType<typeof createTestContext>;
  let clerkId: string;

  beforeEach(async () => {
    t = createTestContext();
    clerkId = `test-${Date.now()}-${Math.random()}`;
    await createTestUser(t, clerkId);
  });

  describe("list", () => {
    it("returns empty array for user with no entries", async () => {
      const entries = await t.query(api.ignoreList.list, { clerkId });
      expect(entries).toEqual([]);
    });

    it("returns entries for user", async () => {
      await t.mutation(api.ignoreList.add, { clerkId, text: "spam" });
      await t.mutation(api.ignoreList.add, { clerkId, text: "buy now" });

      const entries = await t.query(api.ignoreList.list, { clerkId });
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.text)).toContain("spam");
      expect(entries.map((e) => e.text)).toContain("buy now");
    });
  });

  describe("add", () => {
    it("adds new entry", async () => {
      await t.mutation(api.ignoreList.add, { clerkId, text: "unwanted" });

      const entries = await t.query(api.ignoreList.list, { clerkId });
      expect(entries).toHaveLength(1);
      expect(entries[0].text).toBe("unwanted");
      expect(entries[0].addedAt).toBeDefined();
    });

    it("prevents duplicate entries", async () => {
      await t.mutation(api.ignoreList.add, { clerkId, text: "duplicate" });
      await t.mutation(api.ignoreList.add, { clerkId, text: "duplicate" });

      const entries = await t.query(api.ignoreList.list, { clerkId });
      expect(entries).toHaveLength(1);
    });

    it("different users can have same entry", async () => {
      const otherClerkId = `other-${Date.now()}`;
      await createTestUser(t, otherClerkId);

      await t.mutation(api.ignoreList.add, { clerkId, text: "shared" });
      await t.mutation(api.ignoreList.add, { clerkId: otherClerkId, text: "shared" });

      const entries1 = await t.query(api.ignoreList.list, { clerkId });
      const entries2 = await t.query(api.ignoreList.list, { clerkId: otherClerkId });

      expect(entries1).toHaveLength(1);
      expect(entries2).toHaveLength(1);
    });
  });

  describe("remove", () => {
    it("removes entry by text", async () => {
      await t.mutation(api.ignoreList.add, { clerkId, text: "keep" });
      await t.mutation(api.ignoreList.add, { clerkId, text: "remove" });

      await t.mutation(api.ignoreList.remove, { clerkId, text: "remove" });

      const entries = await t.query(api.ignoreList.list, { clerkId });
      expect(entries).toHaveLength(1);
      expect(entries[0].text).toBe("keep");
    });

    it("does nothing if entry does not exist", async () => {
      await t.mutation(api.ignoreList.add, { clerkId, text: "exists" });

      await t.mutation(api.ignoreList.remove, { clerkId, text: "nonexistent" });

      const entries = await t.query(api.ignoreList.list, { clerkId });
      expect(entries).toHaveLength(1);
    });
  });
});
