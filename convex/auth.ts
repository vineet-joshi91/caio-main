import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError, v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { api } from "./_generated/api";

export const {
  auth,
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

function authErrorCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("InvalidAccountId")) return "InvalidAccountId";
  if (message.includes("InvalidSecret")) return "InvalidSecret";
  if (message.includes("already exists")) return "AccountExists";
  if (message.includes("Invalid password")) return "WeakPassword";
  if (message.includes("A valid email address is required")) return "InvalidEmail";
  if (message.includes("InvalidCode")) return "InvalidCode";

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

/**
 * ONE-TIME BOOTSTRAP: Delete auth records for an email so the owner can
 * re-register with a new password. Protected by a hardcoded secret token.
 * Call from browser console:
 *   await convex.mutation("auth:deleteAuthForEmail", { email: "you@example.com", token: "caio-bootstrap-2026" })
 */
export const deleteAuthForEmail = mutation({
  args: { email: v.string(), token: v.string() },
  handler: async (ctx, { email, token }) => {
    if (token !== "caio-bootstrap-2026") {
      throw new ConvexError("INVALID_TOKEN");
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Delete from users (by email index)
    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .collect();
    for (const user of users) {
      // Delete all authAccounts linked to this user (full scan — bootstrap only)
      const allAccounts = await ctx.db.query("authAccounts").collect();
      for (const account of allAccounts) {
        if (account.userId === user._id) {
          await ctx.db.delete(account._id);
        }
      }
      // Delete all authSessions linked to this user
      const allSessions = await ctx.db.query("authSessions").collect();
      for (const session of allSessions) {
        if (session.userId === user._id) {
          await ctx.db.delete(session._id);
        }
      }
      await ctx.db.delete(user._id);
    }

    return { deleted: { accounts: accounts.length, users: users.length } };
  },
});