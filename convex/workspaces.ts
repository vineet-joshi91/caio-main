import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireUser } from './lib/auth'
import { now, uuid } from './lib/ids'
import { requireRole } from './lib/rbac'
import { ensureCreditAccount } from './lib/credits'
import { workspaceRole } from './schema'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect()

    const workspaces = await Promise.all(
      memberships.map(async (membership) => {
        const workspace = await ctx.db.get(membership.workspaceId)
        return workspace ? { ...workspace, role: membership.role } : null
      }),
    )

    return workspaces.filter((workspace) => workspace !== null)
  },
})

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const timestamp = now()
    const workspaceId = await ctx.db.insert('workspaces', {
      uuid: uuid(),
      name: args.name,
      slug: `${slugify(args.name)}-${crypto.randomUUID().slice(0, 8)}`,
      ownerUserId: user._id,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    await ctx.db.insert('memberships', {
      uuid: uuid(),
      workspaceId,
      userId: user._id,
      role: 'owner',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    await ctx.db.insert('businessProfiles', {
      uuid: uuid(),
      workspaceId,
      summary: '',
      goals: [],
      constraints: [],
      updatedByUserId: user._id,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    // Seeds the workspace with its free report credit.
    await ensureCreditAccount(ctx, workspaceId)

    return workspaceId
  },
})

export const update = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'admin')

    await ctx.db.patch(args.workspaceId, {
      name: args.name,
      updatedAt: now(),
    })
  },
})

export const listMembers = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'member')

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()

    return await Promise.all(
      memberships.map(async (membership) => ({
        ...membership,
        user: await ctx.db.get(membership.userId),
      })),
    )
  },
})

export const setMemberRole = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    membershipId: v.id('memberships'),
    role: workspaceRole,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'owner')

    const membership = await ctx.db.get(args.membershipId)
    if (!membership || membership.workspaceId !== args.workspaceId) {
      throw new Error('Membership not found')
    }

    await ctx.db.patch(args.membershipId, {
      role: args.role,
      updatedAt: now(),
    })
  },
})
