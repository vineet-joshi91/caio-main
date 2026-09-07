import { internalMutation, mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireUser } from './lib/auth'
import { now, uuid } from './lib/ids'
import { requireRole } from './lib/rbac'

const score = v.object({
  section: v.string(),
  score: v.number(),
  rationale: v.string(),
})

const citation = v.object({
  documentId: v.optional(v.id('documents')),
  documentTitle: v.string(),
  excerpt: v.string(),
})

export const list = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'member')

    const audits = await ctx.db
      .query('audits')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()

    return await Promise.all(
      audits.map(async (audit) => ({
        ...audit,
        latestVersion: audit.latestVersionId
          ? await ctx.db.get(audit.latestVersionId)
          : null,
      })),
    )
  },
})

export const createVersion = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    auditId: v.optional(v.id('audits')),
    name: v.string(),
    overallScore: v.number(),
    consultingNeed: v.optional(v.string()),
    sectionScores: v.array(score),
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    recommendations: v.array(v.string()),
    citations: v.array(citation),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'admin')

    return await insertVersion(ctx, { ...args, createdByUserId: user._id })
  },
})

// Called from the runAudit action after it has verified admin access.
export const internalCreateVersion = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    auditId: v.optional(v.id('audits')),
    name: v.string(),
    overallScore: v.number(),
    consultingNeed: v.optional(v.string()),
    sectionScores: v.array(score),
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    recommendations: v.array(v.string()),
    citations: v.array(citation),
    createdByUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return await insertVersion(ctx, args)
  },
})

type VersionInput = {
  workspaceId: Id<'workspaces'>
  auditId?: Id<'audits'>
  name: string
  overallScore: number
  consultingNeed?: string
  sectionScores: Array<{ section: string; score: number; rationale: string }>
  strengths: Array<string>
  weaknesses: Array<string>
  recommendations: Array<string>
  citations: Array<{
    documentId?: Id<'documents'>
    documentTitle: string
    excerpt: string
  }>
  createdByUserId: Id<'users'>
}

async function insertVersion(ctx: MutationCtx, args: VersionInput) {
  const timestamp = now()
  const auditId =
    args.auditId ??
    (await ctx.db.insert('audits', {
      uuid: uuid(),
      workspaceId: args.workspaceId,
      name: args.name,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))

  const previousVersions = await ctx.db
    .query('auditVersions')
    .withIndex('by_audit', (q) => q.eq('auditId', auditId))
    .take(500)

  await Promise.all(
    previousVersions
      .filter((version) => version.status === 'current')
      .map((version) => ctx.db.patch(version._id, { status: 'outdated' })),
  )

  const version = previousVersions.length + 1
  const versionId = await ctx.db.insert('auditVersions', {
    uuid: uuid(),
    workspaceId: args.workspaceId,
    auditId,
    version,
    status: 'current',
    overallScore: args.overallScore,
    consultingNeed: args.consultingNeed,
    sectionScores: args.sectionScores,
    strengths: args.strengths,
    weaknesses: args.weaknesses,
    recommendations: args.recommendations,
    citations: args.citations,
    createdByUserId: args.createdByUserId,
    createdAt: timestamp,
  })

  await ctx.db.patch(auditId, {
    latestVersionId: versionId,
    updatedAt: timestamp,
  })

  return versionId
}
