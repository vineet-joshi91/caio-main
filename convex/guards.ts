import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { internalQuery } from './_generated/server'

// Internal auth/context helpers callable from actions and HTTP actions
// (which cannot touch ctx.db directly). Auth propagates through runQuery.

export const workspaceAccess = internalQuery({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_workspace_user', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('userId', userId),
      )
      .unique()

    if (!membership) return null

    return { userId, role: membership.role }
  },
})

export const chatContext = internalQuery({
  args: {
    workspaceId: v.id('workspaces'),
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId)
    if (!workspace) return null

    const profile = await ctx.db
      .query('businessProfiles')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .unique()

    const facts = await ctx.db
      .query('memoryFacts')
      .withIndex('by_workspace_active', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('active', true),
      )
      .take(200)

    return { workspace, profile, facts }
  },
})
