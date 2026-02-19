/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as cleanup from "../cleanup.js";
import type * as commentHelpers from "../commentHelpers.js";
import type * as commenters from "../commenters.js";
import type * as comments from "../comments.js";
import type * as constants from "../constants.js";
import type * as http from "../http.js";
import type * as ignoreList from "../ignoreList.js";
import type * as imageStorage from "../imageStorage.js";
import type * as lib_detectLanguage from "../lib/detectLanguage.js";
import type * as lib_r2 from "../lib/r2.js";
import type * as lib_translate from "../lib/translate.js";
import type * as plans from "../plans.js";
import type * as searchHelpers from "../searchHelpers.js";
import type * as settings from "../settings.js";
import type * as stripe from "../stripe.js";
import type * as stripeHelpers from "../stripeHelpers.js";
import type * as tiktokProfiles from "../tiktokProfiles.js";
import type * as translation from "../translation.js";
import type * as users from "../users.js";
import type * as videos from "../videos.js";
import type * as whitelist from "../whitelist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  cleanup: typeof cleanup;
  commentHelpers: typeof commentHelpers;
  commenters: typeof commenters;
  comments: typeof comments;
  constants: typeof constants;
  http: typeof http;
  ignoreList: typeof ignoreList;
  imageStorage: typeof imageStorage;
  "lib/detectLanguage": typeof lib_detectLanguage;
  "lib/r2": typeof lib_r2;
  "lib/translate": typeof lib_translate;
  plans: typeof plans;
  searchHelpers: typeof searchHelpers;
  settings: typeof settings;
  stripe: typeof stripe;
  stripeHelpers: typeof stripeHelpers;
  tiktokProfiles: typeof tiktokProfiles;
  translation: typeof translation;
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
