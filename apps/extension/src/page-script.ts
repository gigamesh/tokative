/**
 * This script runs in the page context (not extension context) to access React internals.
 * It's injected via a <script> tag to bypass the content script isolation.
 *
 * Comment Hierarchy Structure:
 * - Top-level comments: DivCommentObjectWrapper contains DivCommentItemWrapper + DivReplyContainer
 * - Replies: Inside DivReplyContainer, each reply is a DivCommentItemWrapper
 * - Top-level comments use data-e2e="comment-level-1", replies use "comment-level-2"
 *
 * React fiber comment object contains:
 * - cid: unique comment ID
 * - reply_id: "0" for top-level, parent's cid for replies
 * - reply_to_reply_id: "0" or specific sub-reply's cid (for nested replies)
 * - reply_comment: array of preloaded replies (usually just 1)
 * - reply_comment_total: actual total reply count
 */

import {
  getAllCommentElements,
  REPLY_COMMENT_SELECTOR,
  TOP_LEVEL_COMMENT_SELECTOR,
} from "./content/tiktok/video-selectors";

// TikTok's avatar structure from React fiber
interface TikTokAvatar {
  url_list?: string[];
  uri?: string;
}

// TikTok's comment user structure from React fiber
interface TikTokUser {
  unique_id: string;
  nickname?: string;
  avatar_thumb?: TikTokAvatar;
}

// TikTok's comment structure from React fiber
interface TikTokComment {
  cid: string;
  create_time: number;
  aweme_id?: string;
  text?: string;
  user?: TikTokUser;
  reply_id?: string;
  reply_to_reply_id?: string;
  reply_comment_total?: number;
  reply_comment?: TikTokComment[];
}

// React fiber node structure (simplified - only what we need)
interface ReactFiber {
  memoizedProps?: {
    comment?: TikTokComment;
    children?: ReactChild | ReactChild[];
  };
  child?: ReactFiber;
  sibling?: ReactFiber;
}

interface ReactChild {
  props?: {
    comment?: TikTokComment;
  };
}

// Output format for extracted comment data
interface ExtractedComment {
  index: number;
  cid: string;
  create_time: number;
  aweme_id?: string;
  text?: string;
  user: { unique_id: string; nickname?: string; avatar_thumb?: string } | null;
  reply_id?: string;
  reply_to_reply_id?: string;
  reply_comment_total: number;
  reply_comment: Array<{
    cid: string;
    create_time: number;
    text?: string;
    user: {
      unique_id: string;
      nickname?: string;
      avatar_thumb?: string;
    } | null;
    reply_id?: string;
    reply_to_reply_id?: string;
  }>;
}

// Extend Element to include React fiber key
interface ElementWithFiber extends Element {
  [key: string]: ReactFiber | unknown;
}

(function () {
  function findCommentElements(): Element[] {
    const topLevel = document.querySelectorAll(TOP_LEVEL_COMMENT_SELECTOR);
    const replies = document.querySelectorAll(REPLY_COMMENT_SELECTOR);
    const all = getAllCommentElements();

    // Verbose logging disabled
    // console.log("[Tokative page-script] Found", topLevel.length, "top-level and", replies.length, "replies =", all.length, "total");
    return all;
  }

  function findCommentData(
    fiber: ReactFiber | null | undefined,
    depth = 0,
  ): TikTokComment | null {
    if (depth > 10) return null;
    if (!fiber) return null;

    // Check memoizedProps for comment data
    const props = fiber.memoizedProps;
    if (props) {
      // Direct comment property
      if (props.comment?.cid) {
        return props.comment;
      }
      // Check children array
      if (Array.isArray(props.children)) {
        for (const child of props.children) {
          if (child?.props?.comment?.cid) {
            return child.props.comment;
          }
        }
      }
      // Single child
      const singleChild = props.children as ReactChild | undefined;
      if (singleChild?.props?.comment?.cid) {
        return singleChild.props.comment;
      }
    }

    // Traverse child fiber
    if (fiber.child) {
      const result = findCommentData(fiber.child, depth + 1);
      if (result) return result;
    }

    // Traverse sibling fiber
    if (fiber.sibling) {
      const result = findCommentData(fiber.sibling, depth + 1);
      if (result) return result;
    }

    return null;
  }

  function extractComments(): ExtractedComment[] {
    const results: ExtractedComment[] = [];
    const comments = findCommentElements();

    comments.forEach((el, index) => {
      const keys = Object.getOwnPropertyNames(el);
      const fiberKey = keys.find((k) => k.startsWith("__reactFiber$"));
      if (!fiberKey) {
        return;
      }

      const fiber = (el as ElementWithFiber)[fiberKey] as ReactFiber;
      const comment = findCommentData(fiber);

      if (comment?.cid && comment?.create_time) {
        results.push({
          index,
          cid: comment.cid,
          create_time: comment.create_time,
          aweme_id: comment.aweme_id,
          text: comment.text,
          user: comment.user
            ? {
                unique_id: comment.user.unique_id,
                nickname: comment.user.nickname,
                avatar_thumb: comment.user.avatar_thumb?.url_list?.[0],
              }
            : null,
          reply_id: comment.reply_id,
          reply_to_reply_id: comment.reply_to_reply_id,
          reply_comment_total: comment.reply_comment_total || 0,
          reply_comment: (comment.reply_comment || []).map((r) => ({
            cid: r.cid,
            create_time: r.create_time,
            text: r.text,
            user: r.user
              ? {
                  unique_id: r.user.unique_id,
                  nickname: r.user.nickname,
                  avatar_thumb: r.user.avatar_thumb?.url_list?.[0],
                }
              : null,
            reply_id: r.reply_id,
            reply_to_reply_id: r.reply_to_reply_id,
          })),
        });
      }
    });

    // Verbose logging disabled
    // console.log("[Tokative page-script] Extracted", results.length, "comments with React data");
    return results;
  }

  // Listen for extraction requests from content script
  document.addEventListener("tokative-extract", function () {
    const results = extractComments();
    document.documentElement.setAttribute(
      "data-tokative-comments",
      JSON.stringify(results),
    );
  });

  // Signal that the script is ready
  document.documentElement.setAttribute("data-tokative-ready", "true");
})();
