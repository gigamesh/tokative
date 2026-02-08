import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { iso639_3to1 } from "./translate";

/** Detects languages for a batch of comments and patches the results inline. */
export async function detectLanguages(
  ctx: MutationCtx,
  commentDocIds: Id<"comments">[],
): Promise<void> {
  const { franc } = await import("franc-min");

  for (const docId of commentDocIds) {
    const doc = await ctx.db.get(docId);
    if (!doc || doc.comment.length < 10) continue;

    const detected = franc(doc.comment);
    if (detected === "und") continue;

    await ctx.db.patch(docId, { detectedLanguage: iso639_3to1(detected) });
  }
}
