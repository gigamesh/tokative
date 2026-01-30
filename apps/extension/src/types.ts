export * from "@tokative/shared";

import type { ScrapedComment } from "@tokative/shared";

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
