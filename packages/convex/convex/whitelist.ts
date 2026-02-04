import { query } from "./_generated/server";
import { v } from "convex/values";
import { WHITELISTED_EMAILS } from "./constants";

export const isEmailAllowed = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const emailList = WHITELISTED_EMAILS.map((e) => e.toLowerCase());

    if (emailList.length === 0) {
      return true;
    }

    return emailList.includes(args.email.toLowerCase());
  },
});
