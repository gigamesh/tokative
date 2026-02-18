import { Doc } from "./_generated/dataModel";

/**
 * Given all comments and a search string, returns matching comments with full
 * thread context (parents of matched replies AND replies of matched parents)
 * plus the set of profile IDs that had matching comments.
 *
 * Uses the denormalized `handle` field on comment docs instead of a profile map.
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

  const matchedParentIds = new Set(
    [...matchingIds].filter((id) => {
      const c = commentIdMap.get(id);
      return c && !c.isReply;
    }),
  );
  for (const c of allComments) {
    if (
      c.isReply &&
      c.parentCommentId &&
      matchedParentIds.has(c.parentCommentId) &&
      !matchingIds.has(c.commentId)
    ) {
      matching.push(c);
      matchingIds.add(c.commentId);
    }
  }

  const matchingProfileIds = new Set<string>();
  for (const c of matching) {
    matchingProfileIds.add(c.tiktokProfileId);
  }

  return { results: matching, matchingIds, matchingProfileIds };
}
