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
  const repliesByParent = new Map<string, Doc<"comments">[]>();
  for (const c of allComments) {
    if (c.isReply && c.parentCommentId) {
      const list = repliesByParent.get(c.parentCommentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentCommentId, list);
    }
  }

  for (const c of [...matching]) {
    if (c.isReply && c.parentCommentId && !matchingIds.has(c.parentCommentId)) {
      const parent = commentIdMap.get(c.parentCommentId);
      if (parent) {
        matching.push(parent);
        matchingIds.add(parent.commentId);
      }
    }

    if (!c.isReply) {
      for (const reply of repliesByParent.get(c.commentId) ?? []) {
        if (!matchingIds.has(reply.commentId)) {
          matching.push(reply);
          matchingIds.add(reply.commentId);
        }
      }
    }
  }

  const matchingProfileIds = new Set<string>();
  for (const c of matching) {
    matchingProfileIds.add(c.tiktokProfileId);
  }

  return { results: matching, matchingIds, matchingProfileIds };
}
