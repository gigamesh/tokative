/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as commenters from "../commenters.js";
import type * as comments from "../comments.js";
import type * as constants from "../constants.js";
import type * as http from "../http.js";
import type * as ignoreList from "../ignoreList.js";
import type * as imageStorage from "../imageStorage.js";
import type * as lib_r2 from "../lib/r2.js";
import type * as settings from "../settings.js";
import type * as tiktokProfiles from "../tiktokProfiles.js";
import type * as users from "../users.js";
import type * as videos from "../videos.js";
import type * as whitelist from "../whitelist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  commenters: typeof commenters;
  comments: typeof comments;
  constants: typeof constants;
  http: typeof http;
  ignoreList: typeof ignoreList;
  imageStorage: typeof imageStorage;
  "lib/r2": typeof lib_r2;
  settings: typeof settings;
  tiktokProfiles: typeof tiktokProfiles;
  users: typeof users;
  videos: typeof videos;
  whitelist: typeof whitelist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
