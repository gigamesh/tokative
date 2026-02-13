import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { translateText, iso639_3to1 } from "./lib/translate";
import { franc } from "franc-min";
import { isPremiumWhitelisted } from "./constants";
import { detectLanguages } from "./lib/detectLanguage";

export const patchLanguage = internalMutation({
  args: {
    commentDocId: v.id("comments"),
    detectedLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commentDocId, {
      detectedLanguage: args.detectedLanguage,
    });
  },
});

export const patchTranslation = internalMutation({
  args: {
    commentDocId: v.id("comments"),
    translatedText: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.commentDocId, {
      translatedText: args.translatedText,
    });
  },
});

export const detectLanguagesBatch = internalMutation({
  args: {
    commentDocIds: v.array(v.id("comments")),
  },
  handler: async (ctx, args) => {
    await detectLanguages(ctx, args.commentDocIds);
  },
});

/** Translates app replies in the background. Scheduled by addBatch after scraping. */
export const translateAppReplies = internalAction({
  args: {
    commentDocIds: v.array(v.id("comments")),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    for (const docId of args.commentDocIds) {
      try {
        const comment = await ctx.runQuery(
          internal.translation.getCommentById,
          { commentDocId: docId },
        );
        if (!comment) continue;

        const result = await translateText(
          comment.comment,
          args.targetLanguage,
          comment.detectedLanguage ?? undefined,
        );

        if (result.detectedSourceLanguage === args.targetLanguage) {
          continue;
        }

        await ctx.runMutation(internal.translation.patchTranslation, {
          commentDocId: docId,
          translatedText: result.translatedText,
        });

        if (result.detectedSourceLanguage && result.detectedSourceLanguage !== comment.detectedLanguage) {
          await ctx.runMutation(internal.translation.patchLanguage, {
            commentDocId: docId,
            detectedLanguage: result.detectedSourceLanguage,
          });
        }
      } catch (e) {
        console.error(`Failed to translate app reply ${docId}:`, e);
      }
    }
  },
});

export const getCommentById = internalQuery({
  args: { commentDocId: v.id("comments") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.commentDocId);
  },
});

export const translateComment = action({
  args: {
    clerkId: v.string(),
    commentId: v.string(),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.translation.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user || !isPremiumWhitelisted(user.email ?? "")) {
      throw new Error("Not authorized");
    }

    const comment = await ctx.runQuery(
      internal.translation.getCommentByUserAndId,
      { userId: user._id, commentId: args.commentId },
    );
    if (!comment) throw new Error("Comment not found");

    const result = await translateText(
      comment.comment,
      args.targetLanguage,
      comment.detectedLanguage ?? undefined,
    );

    if (result.detectedSourceLanguage === args.targetLanguage) {
      await ctx.runMutation(internal.translation.patchLanguage, {
        commentDocId: comment._id,
        detectedLanguage: args.targetLanguage,
      });
      return;
    }

    await ctx.runMutation(internal.translation.patchTranslation, {
      commentDocId: comment._id,
      translatedText: result.translatedText,
    });
  },
});

export const backfillLanguageDetection = action({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.translation.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user) throw new Error("User not found");

    const commentIds = await ctx.runQuery(
      internal.translation.getCommentsWithoutLanguage,
      { userId: user._id },
    );

    const BATCH_SIZE = 50;
    for (let i = 0; i < commentIds.length; i += BATCH_SIZE) {
      const batch = commentIds.slice(i, i + BATCH_SIZE);
      await ctx.runMutation(internal.translation.detectLanguagesBatch, {
        commentDocIds: batch,
      });
    }
  },
});

export const backfillAllLanguageDetection = action({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    const commentIds: Id<"comments">[] = await ctx.runQuery(
      internal.translation.getAllCommentIds,
    );

    const BATCH_SIZE = 50;
    for (let i = 0; i < commentIds.length; i += BATCH_SIZE) {
      const batch = commentIds.slice(i, i + BATCH_SIZE);
      await ctx.runMutation(internal.translation.detectLanguagesBatch, {
        commentDocIds: batch,
      });
    }

    return { processed: commentIds.length };
  },
});

// Internal query helpers

export const getUserByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

export const getCommentByUserAndId = internalQuery({
  args: {
    userId: v.id("users"),
    commentId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("comments")
      .withIndex("by_user_and_comment_id", (q) =>
        q.eq("userId", args.userId).eq("commentId", args.commentId),
      )
      .unique();
  },
});

export const getCommentsWithoutLanguage = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return all
      .filter((c) => !c.detectedLanguage)
      .map((c) => c._id);
  },
});

export const getAllCommentsWithoutLanguage = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("comments").collect();
    return all
      .filter((c) => !c.detectedLanguage)
      .map((c) => c._id);
  },
});

export const getAllCommentIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("comments").collect();
    return all.map((c) => c._id);
  },
});

export const getAllCommentsText = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("comments").collect();
    return all.map((c) => ({
      commentId: c.commentId,
      comment: c.comment,
      detectedLanguage: c.detectedLanguage,
    }));
  },
});

/** Temporary diagnostic: runs franc on all comments and returns the analysis. */
export const analyzeFrancDetection = action({
  args: {},
  handler: async (ctx): Promise<Array<{
    comment: string;
    cleanedLength: number;
    francRaw: string;
    francMapped: string | null;
    storedLang: string | null;
  }>> => {
    const comments: Array<{ comment: string; detectedLanguage?: string }> =
      await ctx.runQuery(internal.translation.getAllCommentsText);

    const results = [];
    for (const c of comments) {
      let cleaned = c.comment.replace(/\[.*?\]/g, " ");
      cleaned = cleaned.replace(/[^\p{L}\s]/gu, "");
      cleaned = cleaned.replace(/\s+/g, " ").trim();

      let francRaw = "too_short";
      let francMapped: string | null = null;
      if (cleaned.length >= 20) {
        francRaw = franc(cleaned);
        if (francRaw !== "und") {
          francMapped = iso639_3to1(francRaw);
        }
      }

      results.push({
        comment: c.comment.length > 120 ? c.comment.substring(0, 120) + "..." : c.comment,
        cleanedLength: cleaned.length,
        francRaw,
        francMapped,
        storedLang: c.detectedLanguage ?? null,
      });
    }

    return results;
  },
});
