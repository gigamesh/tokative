export * from "@tiktok-buddy/shared";

import type { ScrapedComment } from "@tiktok-buddy/shared";

export interface StorageData {
  comments: ScrapedComment[];
  settings: {
    messageDelay: number;
    scrollDelay: number;
  };
}

export const DEFAULT_SETTINGS: StorageData["settings"] = {
  messageDelay: 3000,
  scrollDelay: 1500,
};
