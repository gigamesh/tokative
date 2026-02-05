import { query } from "./_generated/server";
import { v } from "convex/values";
import { isEmailWhitelisted } from "./constants";

export const isEmailAllowed = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return isEmailWhitelisted(args.email);
  },
});
