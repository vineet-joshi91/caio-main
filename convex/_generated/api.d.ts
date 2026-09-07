/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as audits from "../audits.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as conversations from "../conversations.js";
import type * as documents from "../documents.js";
import type * as guards from "../guards.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_credits from "../lib/credits.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as memory from "../memory.js";
import type * as notes from "../notes.js";
import type * as prompts from "../prompts.js";
import type * as rag from "../rag.js";
import type * as users from "../users.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  audits: typeof audits;
  auth: typeof auth;
  billing: typeof billing;
  conversations: typeof conversations;
  documents: typeof documents;
  guards: typeof guards;
  http: typeof http;
  ingest: typeof ingest;
  "lib/auth": typeof lib_auth;
  "lib/credits": typeof lib_credits;
  "lib/ids": typeof lib_ids;
  "lib/llm": typeof lib_llm;
  "lib/rbac": typeof lib_rbac;
  memory: typeof memory;
  notes: typeof notes;
  prompts: typeof prompts;
  rag: typeof rag;
  users: typeof users;
  workspaces: typeof workspaces;
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

export declare const components: {
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
};
