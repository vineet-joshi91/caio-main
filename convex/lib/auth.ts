import { getAuthUserId } from '@convex-dev/auth/server'
import type { QueryCtx, MutationCtx } from '../_generated/server'

type AuthCtx = QueryCtx | MutationCtx

export async function requireUser(ctx: AuthCtx) {
  const userId = await getAuthUserId(ctx)
  if (!userId) {
    throw new Error('Authentication required')
  }

  const user = await ctx.db.get(userId)
  if (!user) {
    throw new Error('User profile has not been initialized')
  }

  return user
}

export function userProfileFromIdentity(identity: {
  email?: string | null
  name?: string | null
  pictureUrl?: string | null
}) {
  return {
    email: identity.email ?? undefined,
    name: identity.name ?? undefined,
    image: identity.pictureUrl ?? undefined,
  }
}
