import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireUser } from './lib/auth'
import { now, uuid } from './lib/ids'
import { requireRole } from './lib/rbac'
import { messageRole } from './schema'

export const list = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'member')

    return await ctx.db
      .query('conversations')
      .withIndex('by_workspace_updated', (q) =>
        q.eq('workspaceId', args.workspaceId),
      )
      .order('desc')
      .collect()
  },
})

export const create = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'member')

    const timestamp = now()
    return await ctx.db.insert('conversations', {
      uuid: uuid(),
      workspaceId: args.workspaceId,
      createdByUserId: user._id,
      title: args.title ?? 'New conversation',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  },
})

export const messages = query({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }
    await requireRole(ctx, conversation.workspaceId, user._id, 'member')

    return await ctx.db
      .query('messages')
      .withIndex('by_conversation_created', (q) =>
        q.eq('conversationId', args.conversationId),
      )
      .collect()
  },
})

export const addMessage = mutation({
  args: {
    conversationId: v.id('conversations'),
    role: messageRole,
    content: v.string(),
    citations: v.optional(
      v.array(
        v.object({
          documentId: v.optional(v.id('documents')),
          documentTitle: v.string(),
          chunkId: v.optional(v.id('documentChunks')),
          excerpt: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }
    await requireRole(ctx, conversation.workspaceId, user._id, 'member')

    const timestamp = now()
    const messageId = await ctx.db.insert('messages', {
      uuid: uuid(),
      workspaceId: conversation.workspaceId,
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      citations: args.citations ?? [],
      createdAt: timestamp,
    })

    await ctx.db.patch(args.conversationId, {
      updatedAt: timestamp,
      title:
        conversation.title === 'New conversation' && args.role === 'user'
          ? args.content.slice(0, 80)
          : conversation.title,
    })

    return messageId
  },
})

// Called from the /api/chat HTTP action, which performs its own workspace
// access check before streaming; this skips the redundant RBAC round-trip.
export const internalAddMessage = internalMutation({
  args: {
    conversationId: v.id('conversations'),
    role: messageRole,
    content: v.string(),
    citations: v.optional(
      v.array(
        v.object({
          documentId: v.optional(v.id('documents')),
          documentTitle: v.string(),
          chunkId: v.optional(v.id('documentChunks')),
          excerpt: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId)
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const timestamp = now()
    const messageId = await ctx.db.insert('messages', {
      uuid: uuid(),
      workspaceId: conversation.workspaceId,
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      citations: args.citations ?? [],
      createdAt: timestamp,
    })

    await ctx.db.patch(args.conversationId, {
      updatedAt: timestamp,
      title:
        conversation.title === 'New conversation' && args.role === 'user'
          ? args.content.slice(0, 80)
          : conversation.title,
    })

    return messageId
  },
})
