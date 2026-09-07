import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { rag } from './rag'
import type { EntryId } from '@convex-dev/rag'
import { requireUser } from './lib/auth'
import { now, uuid } from './lib/ids'
import { requireRole } from './lib/rbac'
import { documentStatus } from './schema'

export const list = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'member')

    return await ctx.db
      .query('documents')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .order('desc')
      .take(200)
  },
})

export const generateUploadUrl = mutation({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'admin')

    return await ctx.storage.generateUploadUrl()
  },
})

export const createUploadRecord = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    filename: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'admin')

    const timestamp = now()
    const documentId = await ctx.db.insert('documents', {
      uuid: uuid(),
      workspaceId: args.workspaceId,
      uploadedByUserId: user._id,
      filename: args.filename,
      mimeType: args.mimeType,
      byteSize: args.byteSize,
      storageId: args.storageId,
      status: 'processing',
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    await ctx.scheduler.runAfter(0, internal.ingest.processDocument, {
      documentId,
    })

    return documentId
  },
})

export const remove = mutation({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const document = await ctx.db.get(args.documentId)
    if (!document) {
      return
    }
    await requireRole(ctx, document.workspaceId, user._id, 'admin')

    await deleteChunks(ctx, args.documentId)
    if (document.storageId) {
      await ctx.storage.delete(document.storageId)
    }
    if (document.ragEntryId) {
      // Removes the entry and its embeddings in the background via workpool.
      await rag.deleteAsync(ctx, { entryId: document.ragEntryId as EntryId })
    }
    await ctx.db.delete(args.documentId)
  },
})

// ---------------------------------------------------------------------------
// Internal pipeline functions (no client access; invoked by ingest actions).
// ---------------------------------------------------------------------------

export const internalGet = internalQuery({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId)
  },
})

export const internalSetStatus = internalMutation({
  args: {
    documentId: v.id('documents'),
    status: documentStatus,
    statusReason: v.optional(v.string()),
    ragEntryId: v.optional(v.string()),
    extractedTextPreview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId)
    if (!document) return

    await ctx.db.patch(args.documentId, {
      status: args.status,
      statusReason: args.statusReason,
      ragEntryId: args.ragEntryId,
      extractedTextPreview: args.extractedTextPreview,
      updatedAt: now(),
    })

    // A document becoming ready invalidates current audit versions.
    if (args.status === 'ready') {
      const currentAudits = await ctx.db
        .query('auditVersions')
        .withIndex('by_workspace_status', (q) =>
          q.eq('workspaceId', document.workspaceId).eq('status', 'current'),
        )
        .take(100)

      await Promise.all(
        currentAudits.map((audit) =>
          ctx.db.patch(audit._id, { status: 'outdated' }),
        ),
      )
    }
  },
})

export const internalReplaceChunks = internalMutation({
  args: {
    documentId: v.id('documents'),
    chunks: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId)
    if (!document) return

    await deleteChunks(ctx, args.documentId)

    const timestamp = now()
    await Promise.all(
      args.chunks.map((text, chunkIndex) =>
        ctx.db.insert('documentChunks', {
          uuid: uuid(),
          workspaceId: document.workspaceId,
          documentId: args.documentId,
          chunkIndex,
          text,
          citationLabel: `${document.filename} #${chunkIndex + 1}`,
          createdAt: timestamp,
        }),
      ),
    )
  },
})

async function deleteChunks(ctx: MutationCtx, documentId: Id<'documents'>) {
  for (;;) {
    const batch = await ctx.db
      .query('documentChunks')
      .withIndex('by_document', (q) => q.eq('documentId', documentId))
      .take(500)
    if (batch.length === 0) break
    await Promise.all(batch.map((chunk) => ctx.db.delete(chunk._id)))
    if (batch.length < 500) break
  }
}
