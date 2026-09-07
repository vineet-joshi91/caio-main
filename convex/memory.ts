import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireUser } from './lib/auth'
import { now, uuid } from './lib/ids'
import { requireRole } from './lib/rbac'
import { memoryFactType } from './schema'

export const getBusinessProfile = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'member')

    return await ctx.db
      .query('businessProfiles')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .unique()
  },
})

export const updateBusinessProfile = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    summary: v.string(),
    industry: v.optional(v.string()),
    businessModel: v.optional(v.string()),
    targetCustomers: v.optional(v.string()),
    goals: v.array(v.string()),
    constraints: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'admin')

    const existing = await ctx.db
      .query('businessProfiles')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .unique()

    const timestamp = now()
    const profile = {
      summary: args.summary,
      industry: args.industry,
      businessModel: args.businessModel,
      targetCustomers: args.targetCustomers,
      goals: args.goals,
      constraints: args.constraints,
      updatedByUserId: user._id,
      updatedAt: timestamp,
    }

    if (existing) {
      await ctx.db.patch(existing._id, profile)
      return existing._id
    }

    return await ctx.db.insert('businessProfiles', {
      uuid: uuid(),
      workspaceId: args.workspaceId,
      ...profile,
      createdAt: timestamp,
    })
  },
})

export const listFacts = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'member')

    return await ctx.db
      .query('memoryFacts')
      .withIndex('by_workspace_active', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('active', true),
      )
      .collect()
  },
})

export const upsertFact = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    type: memoryFactType,
    fact: v.string(),
    sourceConversationId: v.optional(v.id('conversations')),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'admin')

    const timestamp = now()
    return await ctx.db.insert('memoryFacts', {
      uuid: uuid(),
      workspaceId: args.workspaceId,
      type: args.type,
      fact: args.fact,
      sourceConversationId: args.sourceConversationId,
      confidence: args.confidence,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  },
})

// Written by the advisor agent (saveMemoryFact tool) after the /api/chat
// HTTP action has verified workspace membership.
export const internalRecordFact = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    type: memoryFactType,
    fact: v.string(),
    sourceConversationId: v.optional(v.id('conversations')),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const timestamp = now()
    return await ctx.db.insert('memoryFacts', {
      uuid: uuid(),
      workspaceId: args.workspaceId,
      type: args.type,
      fact: args.fact,
      sourceConversationId: args.sourceConversationId,
      confidence: Math.max(0, Math.min(1, args.confidence)),
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  },
})

export const deactivateFact = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    factId: v.id('memoryFacts'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'admin')

    const fact = await ctx.db.get(args.factId)
    if (!fact || fact.workspaceId !== args.workspaceId) {
      throw new Error('Memory fact not found')
    }

    await ctx.db.patch(args.factId, {
      active: false,
      updatedAt: now(),
    })
  },
})
