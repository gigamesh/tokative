export interface ExtensionConfig {
  minExtensionVersion: string;

  selectors: {
    inbox: Record<string, string[]>;
    video: Record<string, string[]>;
  };

  timeouts: {
    selectorWait: number;
    skeletonLoader: number;
    thumbnailLoad: number;
    modalClose: number;
    commentPost: number;
    rateLimitPause: number;
    tabLoad: number;
    replyTimeout: number;
    commentLoadWait: number;
    firstCommentWait: number;
    apiPageDelay: number;
    apiBackoffInitial: number;
    apiBackoffMax: number;
    mentionDropdownWait: number;
  };

  delays: {
    profiles: Record<string, { mean: number; stdDev: number; min: number; max: number }>;
    reactSettle: number;
    scrollUp: number;
    postReply: number;
    fallbackContent: number;
  };

  limits: {
    maxClicksPerThread: number;
    stableIterationsRequired: number;
    consecutiveNoReplies: number;
    contentScriptRetries: number;
    contentScriptRetryDelay: number;
  };

  features?: {
    enableReplyDetection?: boolean;
    enableRateLimitAutoResume?: boolean;
    enableApiFetching?: boolean;
    enableMention?: boolean;
  };

  api: {
    endpoints: {
      commentList: string;
      commentReply: string;
    };
    interceptPattern: string;
    replyPathSegment: string;

    params: {
      videoId: string;
      itemId: string;
      commentId: string;
      cursor: string;
      count: string;
      msToken: string;
    };
    perRequestParams: string[];

    response: {
      comments: string;
      cursor: string;
      hasMore: string;
      total: string;
      statusCode: string;
      successValue: number;
      hasMoreValue: number;
    };

    commentFields: {
      id: string;
      createTime: string;
      videoId: string;
      text: string;
      user: string;
      replyId: string;
      replyToReplyId: string;
      replyCount: string;
      replies: string;
    };

    userFields: {
      id: string;
      uniqueId: string;
      nickname: string;
      avatarThumb: string;
      avatarUrlList: string;
    };

    signing: {
      primaryPath: string;
      fallbackMethod: string;
      fallbackSign: string;
      fallbackKeyPattern: string;
    };

    cookie: {
      tokenName: string;
      tokenPattern: string;
    };

    pagination: {
      pageCount: number;
      batchSize: number;
      maxRetries: number;
      capturedParamsTimeout: number;
    };
  };

  messages: {
    overlayFooter: string;
  };
}

export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

export function isVersionCompatible(
  minExtensionVersion: string,
  currentExtensionVersion: string
): boolean {
  return compareVersions(currentExtensionVersion, minExtensionVersion) >= 0;
}
