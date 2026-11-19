import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
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
      // Log reset codes to Convex dashboard (no email provider configured yet)
      async generateVerificationToken() {
        return Math.floor(100000 + Math.random() * 900000).toString();
      },
      async sendVerificationRequest({ identifier: email, token, provider }) {
        // Until an email provider is wired up, the code is logged to Convex
        // dashboard → Logs. Search for "CAIO password reset" to find it.
        console.log(
          `CAIO password reset for ${email} — code: ${token}`
        );
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
