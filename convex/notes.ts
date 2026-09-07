import { v } from 'convex/values'
import { defaultChunker } from '@convex-dev/rag'
import type { EntryId } from '@convex-dev/rag'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { internal } from './_generated/api'
import { rag, workspaceNamespace } from './rag'
import { requireUser } from './lib/auth'
import { now, uuid } from './lib/ids'
import { requireRole } from './lib/rbac'

// Documents written on the platform (markdown, with images stored in Convex
// file storage). Saved notes are indexed into the workspace RAG namespace so
// the advisor and audits can use them like uploaded documents.

export const list = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'member')

    const notes = await ctx.db
      .query('notes')
      .withIndex('by_workspace_updated', (q) =>
        q.eq('workspaceId', args.workspaceId),
      )
      .order('desc')
      .take(200)

    // The editor loads content via `get`; the list stays light.
    return notes.map((note) => ({
      _id: note._id,
      title: note.title,
      updatedAt: note.updatedAt,
      indexedAt: note.indexedAt,
      preview: note.content.slice(0, 160),
    }))
  },
})

export const get = query({
  args: { noteId: v.id('notes') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const note = await ctx.db.get(args.noteId)
    if (!note) return null
    await requireRole(ctx, note.workspaceId, user._id, 'member')
    return note
  },
})

export const create = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'admin')

    const timestamp = now()
    const noteId = await ctx.db.insert('notes', {
      uuid: uuid(),
      workspaceId: args.workspaceId,
      createdByUserId: user._id,
      title: args.title.trim() || 'Untitled document',
      content: args.content,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    await ctx.scheduler.runAfter(0, internal.notes.indexNote, { noteId })

    return noteId
  },
})

export const update = mutation({
  args: {
    noteId: v.id('notes'),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const note = await ctx.db.get(args.noteId)
    if (!note) throw new Error('Document not found')
    await requireRole(ctx, note.workspaceId, user._id, 'admin')

    await ctx.db.patch(args.noteId, {
      title: args.title.trim() || 'Untitled document',
      content: args.content,
      updatedAt: now(),
    })

    await ctx.scheduler.runAfter(0, internal.notes.indexNote, {
      noteId: args.noteId,
    })
  },
})

export const remove = mutation({
  args: { noteId: v.id('notes') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const note = await ctx.db.get(args.noteId)
    if (!note) return
    await requireRole(ctx, note.workspaceId, user._id, 'admin')

    if (note.ragEntryId) {
      await rag.deleteAsync(ctx, { entryId: note.ragEntryId as EntryId })
    }
    await ctx.db.delete(args.noteId)
  },
})

// Images embedded in written documents live in Convex file storage; the
// editor inserts the resolved URL into the markdown.
export const generateImageUploadUrl = mutation({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'admin')

    return await ctx.storage.generateUploadUrl()
  },
})

export const resolveImageUrl = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'admin')

    const url = await ctx.storage.getUrl(args.storageId)
    if (!url) throw new Error('Uploaded image was not found')
    return url
  },
})

export const internalGet = internalQuery({
  args: { noteId: v.id('notes') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.noteId)
  },
})

export const internalMarkIndexed = internalMutation({
  args: {
    noteId: v.id('notes'),
    ragEntryId: v.string(),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId)
    if (!note) return
    await ctx.db.patch(args.noteId, {
      ragEntryId: args.ragEntryId,
      indexedAt: now(),
    })

    // New written content invalidates current audit versions, same as a
    // freshly processed upload.
    const currentAudits = await ctx.db
      .query('auditVersions')
      .withIndex('by_workspace_status', (q) =>
        q.eq('workspaceId', note.workspaceId).eq('status', 'current'),
      )
      .take(100)
    await Promise.all(
      currentAudits.map((audit) =>
        ctx.db.patch(audit._id, { status: 'outdated' }),
      ),
    )
  },
})

export const indexNote = internalAction({
  args: { noteId: v.id('notes') },
  handler: async (ctx, args) => {
    const note = await ctx.runQuery(internal.notes.internalGet, {
      noteId: args.noteId,
    })
    if (!note) return null

    const text = `${note.title}\n\n${note.content}`.trim()
    if (!text) return null

    // Reusing the note uuid as the key replaces the previous entry atomically.
    const { entryId } = await rag.add(ctx, {
      namespace: workspaceNamespace(note.workspaceId),
      key: note.uuid,
      title: note.title,
      chunks: defaultChunker(text),
    })

    await ctx.runMutation(internal.notes.internalMarkIndexed, {
      noteId: args.noteId,
      ragEntryId: entryId,
    })

    return null
  },
})
