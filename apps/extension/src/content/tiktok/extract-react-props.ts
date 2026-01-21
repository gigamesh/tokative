// This script runs in the MAIN world to access React props
// Injected via <script src> to bypass CSP inline restrictions

(function() {
  document.addEventListener('extract-react-props', ((event: CustomEvent) => {
    const { selector } = event.detail;
    const li = document.querySelector(selector);

    if (!li) {
      return;
    }

    const keys = Object.getOwnPropertyNames(li);
    const reactPropsKey = keys.find(k => k.startsWith('__reactProps$'));

    if (!reactPropsKey) {
      li.setAttribute('data-video-url-cached', '');
      return;
    }

    const props = (li as any)[reactPropsKey];
    const commentData = props?.children?.props?.item?.comment;

    // Log full structure to see what's available
    console.log('[MainWorld] Full commentData:', JSON.stringify(commentData, null, 2));

    const awemeId = commentData?.comment?.aweme_id;
    const cid = commentData?.comment?.cid;
    const authorHandle = commentData?.aweme?.author?.unique_id;

    if (awemeId && cid && authorHandle) {
      const encodedCid = btoa(cid);
      li.setAttribute('data-video-url-cached', `https://www.tiktok.com/@${authorHandle}/video/${awemeId}?cid=${encodedCid}`);
    } else {
      li.setAttribute('data-video-url-cached', '');
    }
  }) as EventListener);
})();
