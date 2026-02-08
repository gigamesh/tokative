import { v } from "convex/values";
import { internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { translateText, translateBatch } from "./lib/translate";
import { isEmailWhitelisted } from "./constants";

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
    const { detectLanguages } = await import("./lib/detectLanguage");
    await detectLanguages(ctx, args.commentDocIds);
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
    if (!user || !isEmailWhitelisted(user.email ?? "")) {
      throw new Error("Not authorized");
    }

    const comment = await ctx.runQuery(
      internal.translation.getCommentByUserAndId,
      { userId: user._id, commentId: args.commentId },
    );
    if (!comment) throw new Error("Comment not found");

    const translated = await translateText(
      comment.comment,
      args.targetLanguage,
      comment.detectedLanguage ?? undefined,
    );

    await ctx.runMutation(internal.translation.patchTranslation, {
      commentDocId: comment._id,
      translatedText: translated,
    });
  },
});

export const translateBatchComments = action({
  args: {
    clerkId: v.string(),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.translation.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user || !isEmailWhitelisted(user.email ?? "")) {
      throw new Error("Not authorized");
    }

    const untranslated = await ctx.runQuery(
      internal.translation.getUntranslatedComments,
      { userId: user._id, targetLanguage: args.targetLanguage },
    );

    const BATCH_SIZE = 100;
    for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
      const batch = untranslated.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.comment);
      const translated = await translateBatch(texts, args.targetLanguage);

      for (let j = 0; j < batch.length; j++) {
        await ctx.runMutation(internal.translation.patchTranslation, {
          commentDocId: batch[j]._id,
          translatedText: translated[j],
        });
      }
    }
  },
});

export const translateReplyText = action({
  args: {
    clerkId: v.string(),
    messages: v.array(v.string()),
    targetLanguages: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Record<string, string[]>> => {
    const user = await ctx.runQuery(internal.translation.getUserByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user || !isEmailWhitelisted(user.email ?? "")) {
      throw new Error("Not authorized");
    }

    const result: Record<string, string[]> = {};
    for (const lang of args.targetLanguages) {
      const translated = await translateBatch(args.messages, lang);
      result[lang] = translated;
    }
    return result;
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

export const getUntranslatedComments = internalQuery({
  args: {
    userId: v.id("users"),
    targetLanguage: v.string(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("comments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return all.filter(
      (c) =>
        c.detectedLanguage &&
        c.detectedLanguage !== args.targetLanguage &&
        !c.translatedText,
    );
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
