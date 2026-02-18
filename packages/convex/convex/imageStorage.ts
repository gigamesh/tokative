import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { uploadToR2, getR2Url, hashArrayBuffer } from "./lib/r2";

export const storeAvatar = internalAction({
  args: {
    profileId: v.id("tiktokProfiles"),
    tiktokUserId: v.string(),
    tiktokUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const MAX_ATTEMPTS = 3;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(args.tiktokUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Referer: "https://www.tiktok.com/",
          },
        });

        if (response.ok) {
          const contentType =
            response.headers.get("content-type") || "image/jpeg";
          const data = await response.arrayBuffer();

          const hash = await hashArrayBuffer(data);
          const extension = contentType.includes("png") ? "png" : "jpg";
          const key = `avatars/${args.tiktokUserId}/${hash}.${extension}`;

          await uploadToR2(key, data, contentType);

          const avatarUrl = getR2Url(key);
          await ctx.runMutation(internal.imageStorage.updateProfileAvatarUrl, {
            profileId: args.profileId,
            avatarUrl,
          });
          return;
        }

        if (response.status === 429) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }

        console.error(`Failed to fetch avatar: ${response.status}`);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }

    console.error("Failed to store avatar after retries:", lastError);
  },
});

export const updateProfileAvatarUrl = internalMutation({
  args: {
    profileId: v.id("tiktokProfiles"),
    avatarUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      avatarUrl: args.avatarUrl,
    });
  },
});

export const storeThumbnail = internalAction({
  args: {
    videoDbId: v.id("videos"),
    videoId: v.string(),
    tiktokUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const response = await fetch(args.tiktokUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Referer: "https://www.tiktok.com/",
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch thumbnail: ${response.status}`);
        return;
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      const data = await response.arrayBuffer();

      const extension = contentType.includes("png") ? "png" : "jpg";
      const key = `thumbnails/${args.videoId}.${extension}`;

      await uploadToR2(key, data, contentType);

      const thumbnailUrl = getR2Url(key);
      await ctx.runMutation(internal.imageStorage.updateVideoThumbnailUrl, {
        videoDbId: args.videoDbId,
        thumbnailUrl,
      });
    } catch (error) {
      console.error("Failed to store thumbnail:", error);
    }
  },
});

export const updateVideoThumbnailUrl = internalMutation({
  args: {
    videoDbId: v.id("videos"),
    thumbnailUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.videoDbId, {
      thumbnailUrl: args.thumbnailUrl,
    });
  },
});
