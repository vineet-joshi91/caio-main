import { getAuthUserId } from '@convex-dev/auth/server'
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { now, uuid } from './lib/ids'
import { userProfileFromIdentity } from './lib/auth'

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()

    if (!identity) {
      return null
    }

    const userId = await getAuthUserId(ctx)
    return userId ? await ctx.db.get(userId) : null
  },
})

export const ensureCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Authentication required')
    }

    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error('Authentication required')
    }

    const existing = await ctx.db.get(userId)

    const timestamp = now()
    const profile = userProfileFromIdentity(identity)

    if (existing) {
      await ctx.db.patch(userId, {
        ...profile,
        uuid: existing.uuid ?? uuid(),
        updatedAt: timestamp,
      })
      return userId
    }

    await ctx.db.patch(userId, {
      uuid: uuid(),
      ...profile,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    return userId
  },
})

export const getById = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})
