import { franc } from "franc-min";
import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { iso639_3to1 } from "./translate";

const MIN_TEXT_LENGTH = 10;

/** Strips emojis, bracket content (e.g. [sticker]), and other non-linguistic characters. */
function extractText(input: string): string {
  let text = input.replace(/\[.*?\]/g, " ");
  text = text.replace(/[^\p{L}\s]/gu, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

/** Resolves the user's own TikTok handle from settings, returning null if unset. */
async function getOwnHandle(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<string | null> {
  const settings = await ctx.db
    .query("settings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return settings?.accountHandle ?? null;
}

/** Detects languages for a batch of comments and patches the results inline. Skips comments authored by the user. */
export async function detectLanguages(
  ctx: MutationCtx,
  commentDocIds: Id<"comments">[],
): Promise<void> {
  if (commentDocIds.length === 0) return;

  const firstDoc = await ctx.db.get(commentDocIds[0]);
  const ownHandle = firstDoc ? await getOwnHandle(ctx, firstDoc.userId) : null;
  const profileHandleCache = new Map<string, string>();

  for (const docId of commentDocIds) {
    const doc = docId === commentDocIds[0] ? firstDoc : await ctx.db.get(docId);
    if (!doc) continue;

    if (doc.source === "app") {
      if (doc.detectedLanguage) await ctx.db.patch(docId, { detectedLanguage: undefined });
      continue;
    }

    if (ownHandle) {
      const profileKey = doc.tiktokProfileId.toString();
      let handle = profileHandleCache.get(profileKey);
      if (handle === undefined) {
        const profile = await ctx.db.get(doc.tiktokProfileId);
        handle = profile?.handle ?? "";
        profileHandleCache.set(profileKey, handle);
      }
      if (handle.toLowerCase() === ownHandle.toLowerCase()) {
        if (doc.detectedLanguage) await ctx.db.patch(docId, { detectedLanguage: undefined });
        continue;
      }
    }

    const cleaned = extractText(doc.comment);
    if (cleaned.length < MIN_TEXT_LENGTH) {
      if (doc.detectedLanguage) await ctx.db.patch(docId, { detectedLanguage: undefined });
      continue;
    }

    const detected = franc(cleaned);
    if (detected === "und") {
      if (doc.detectedLanguage) await ctx.db.patch(docId, { detectedLanguage: undefined });
      continue;
    }

    const lang = detected === "eng" ? "en" : (iso639_3to1(detected) ?? "other");

    if (doc.detectedLanguage !== lang) {
      await ctx.db.patch(docId, { detectedLanguage: lang });
    }
  }
}
