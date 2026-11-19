// convex/admin.ts
// All queries/mutations here are gated to the hardcoded admin email.
// Only vineetpjoshi.71@gmail.com can call these.

import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getAuthUserId } from '@convex-dev/auth/server'
import { adjustCredits } from './lib/credits'
import { now, uuid } from './lib/ids'

const ADMIN_EMAIL = 'vineetpjoshi.71@gmail.com'

async function requireAdmin(ctx: { auth: any; db: any }) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('NOT_AUTHENTICATED')
  const user = await ctx.db.get(userId)
  if (!user || user.email !== ADMIN_EMAIL) throw new ConvexError('NOT_ADMIN')
  return user
}

// ── Users ──────────────────────────────────────────────────────────────────

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const users = await ctx.db.query('users').order('desc').take(500)
    // Attach workspace count per user
    const result = await Promise.all(
      users.map(async (u) => {
        const memberships = await ctx.db
          .query('memberships')
          .withIndex('by_user', (q: any) => q.eq('userId', u._id))
          .collect()
        return { ...u, workspaceCount: memberships.length }
      }),
    )
    return result
  },
})

// ── Workspaces ─────────────────────────────────────────────────────────────

export const listWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const workspaces = await ctx.db.query('workspaces').order('desc').take(200)
    const result = await Promise.all(
      workspaces.map(async (ws) => {
        const owner = await ctx.db.get(ws.ownerUserId)
        const docCount = (
          await ctx.db
            .query('documents')
            .withIndex('by_workspace', (q: any) => q.eq('workspaceId', ws._id))
            .collect()
        ).length
        const auditCount = (
          await ctx.db
            .query('audits')
            .withIndex('by_workspace', (q: any) => q.eq('workspaceId', ws._id))
            .collect()
        ).length
        const creditAccount = await ctx.db
          .query('creditAccounts')
          .withIndex('by_workspace', (q: any) => q.eq('workspaceId', ws._id))
          .unique()
        return {
          ...ws,
          ownerEmail: owner?.email ?? '—',
          ownerName: owner?.name ?? '—',
          docCount,
          auditCount,
          credits: creditAccount?.balance ?? 1,
        }
      }),
    )
    return result
  },
})

// ── Payments & ledger ──────────────────────────────────────────────────────

export const listPayments = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const payments = await ctx.db.query('payments').order('desc').take(300)
    const result = await Promise.all(
      payments.map(async (p) => {
        const user = await ctx.db.get(p.userId)
        const ws = await ctx.db.get(p.workspaceId)
        return {
          ...p,
          userEmail: user?.email ?? '—',
          workspaceName: ws?.name ?? '—',
        }
      }),
    )
    return result
  },
})

// ── Grant credits ──────────────────────────────────────────────────────────

export const grantCredits = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    credits: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const adminUser = await requireAdmin(ctx)
    await adjustCredits(ctx, {
      workspaceId: args.workspaceId,
      delta: args.credits,
      reason: 'purchase', // closest available reason
      userId: adminUser._id,
    })
    return { ok: true }
  },
})

// ── Invites ────────────────────────────────────────────────────────────────

export const listInvites = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    // Onboarding requests are stored as pending memberships with invitedEmail set
    // but no userId matched yet, OR we surface all users sorted by createdAt
    // as a proxy (since CAIO is invite-only, every user was manually let in).
    const users = await ctx.db.query('users').order('desc').take(500)
    return users.map((u) => ({
      _id: u._id,
      email: u.email ?? '—',
      name: u.name ?? '—',
      createdAt: u.createdAt ?? 0,
    }))
  },
})

// ── Admin workspace (unlimited credits for Vineet) ─────────────────────────
// Call this once after first sign-in to top up your own workspace to 9999.

export const topUpAdminWorkspace = mutation({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    // Set balance to 9999 by inserting a large grant
    const creditAccount = await ctx.db
      .query('creditAccounts')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .unique()
    const current = creditAccount?.balance ?? 1
    const delta = 9999 - current
    if (delta <= 0) return { ok: true, balance: current }
    await adjustCredits(ctx, {
      workspaceId: args.workspaceId,
      delta,
      reason: 'purchase',
    })
    return { ok: true, balance: 9999 }
  },
})
