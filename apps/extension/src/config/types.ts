export interface RemoteConfig {
  version: string;
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
  configVersion: string,
  minExtensionVersion: string,
  currentExtensionVersion: string
): boolean {
  return compareVersions(currentExtensionVersion, minExtensionVersion) >= 0;
}
