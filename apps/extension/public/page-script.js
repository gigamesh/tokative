// This script runs in the page context to access React internals
(function() {
  // Multiple selectors to try - TikTok uses different classes in different contexts
  const COMMENT_SELECTORS = [
    '[class*="DivCommentObjectWrapper"]',
    '[class*="DivCommentItemContainer"]',
    '[class*="DivCommentItemWrapper"]',
    '[class*="CommentItemWrapper"]',
    '[data-e2e="comment-level-1"]'
  ];

  function findCommentElements() {
    for (const selector of COMMENT_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log("[TikTok Buddy page-script] Found", elements.length, "comments with selector:", selector);
        return elements;
      }
    }
    console.log("[TikTok Buddy page-script] No comments found with any selector");
    return [];
  }

  function findCommentData(fiber, depth = 0) {
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
      if (props.children?.props?.comment?.cid) {
        return props.children.props.comment;
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

  function extractComments() {
    const results = [];
    const comments = findCommentElements();

    comments.forEach((el, index) => {
      const keys = Object.getOwnPropertyNames(el);
      const fiberKey = keys.find(k => k.startsWith("__reactFiber$"));
      if (!fiberKey) {
        return;
      }

      const fiber = el[fiberKey];
      const comment = findCommentData(fiber);

      if (comment?.cid && comment?.create_time) {
        results.push({
          index,
          cid: comment.cid,
          create_time: comment.create_time,
          aweme_id: comment.aweme_id
        });
      }
    });

    console.log("[TikTok Buddy page-script] Extracted", results.length, "comments with React data");
    return results;
  }

  // Listen for extraction requests
  document.addEventListener("tiktok-buddy-extract", function() {
    const results = extractComments();
    document.documentElement.setAttribute(
      "data-tiktok-buddy-comments",
      JSON.stringify(results)
    );
  });

  // Signal that the script is ready
  document.documentElement.setAttribute("data-tiktok-buddy-ready", "true");
})();
