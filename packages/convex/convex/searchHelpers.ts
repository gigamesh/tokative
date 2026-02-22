import { Doc } from "./_generated/dataModel";

/**
 * Given all comments and a search string, returns matching comments plus the
 * parent of any matched reply (for context). Uses the denormalized `handle`
 * field on comment docs instead of a profile map.
 */
export function buildSearchResults(
  allComments: Doc<"comments">[],
  searchLower: string,
) {
  const matchingIds = new Set<string>();
  const matching: Doc<"comments">[] = [];

  for (const c of allComments) {
    const handle = c.handle ?? "";
    if (
      c.comment.toLowerCase().includes(searchLower) ||
      handle.toLowerCase().includes(searchLower)
    ) {
      matchingIds.add(c.commentId);
      matching.push(c);
    }
  }

  const commentIdMap = new Map(allComments.map((c) => [c.commentId, c]));

  for (const c of [...matching]) {
    if (c.isReply && c.parentCommentId && !matchingIds.has(c.parentCommentId)) {
      const parent = commentIdMap.get(c.parentCommentId);
      if (parent) {
        matching.push(parent);
        matchingIds.add(parent.commentId);
      }
    }
  }

  const matchingProfileIds = new Set<string>();
  for (const c of matching) {
    matchingProfileIds.add(c.tiktokProfileId);
  }

  return { results: matching, matchingIds, matchingProfileIds };
}
