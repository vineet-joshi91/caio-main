import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const {
  auth,
  // Exported under a non-default name so the `signIn` below can wrap it. The
  // client only ever calls `signIn`.
  signIn: rawSignIn,
  signOut,
  store,
  isAuthenticated,
} = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();

        if (!email.includes("@")) {
          throw new Error("A valid email address is required");
        }

        return { email };
      },
    }),
  ],
});

/**
 * Convex redacts plain `Error` messages in production, replacing them with an
 * opaque "Server Error". Convex Auth signals every credential failure with a
 * plain `Error` ("InvalidSecret", "InvalidAccountId", "Account <email> already
 * exists"), so without this the browser cannot tell a wrong password from a
 * missing account from a genuine backend outage.
 *
 * `ConvexError.data` is *not* redacted, so we re-throw the known failures with
 * a stable code the client can branch on. Anything unrecognised is left alone
 * — a real server fault should keep looking like one.
 */
function authErrorCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("InvalidAccountId")) return "InvalidAccountId";
  if (message.includes("InvalidSecret")) return "InvalidSecret";
  if (message.includes("already exists")) return "AccountExists";
  if (message.includes("Invalid password")) return "WeakPassword";
  if (message.includes("A valid email address is required")) return "InvalidEmail";

  return null;
}

type SignInResult = {
  redirect?: string;
  verifier?: string;
  tokens?: { token: string; refreshToken: string } | null;
  started?: boolean;
};

export const signIn = action({
  args: {
    provider: v.optional(v.string()),
    params: v.optional(v.any()),
    verifier: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    calledBy: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SignInResult> => {
    try {
      return await ctx.runAction(api.auth.rawSignIn, args);
    } catch (error) {
      const code = authErrorCode(error);

      if (code === null) {
        throw error;
      }

      throw new ConvexError(code);
    }
  },
});
