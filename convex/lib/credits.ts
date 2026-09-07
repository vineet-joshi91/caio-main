import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { now, uuid } from './ids'

// Report credits are tracked per workspace. They are intentionally not shown
// to users — the only user-visible effect is the purchase prompt when a
// report is requested with an empty balance.

// Every workspace gets one free report so new users can try the product.
export const FREE_REPORT_CREDITS = 1

// The single pack sold today: ₹799 for 10 reports (amount is in paise).
export const REPORT_PACK = {
  credits: 10,
  amountPaise: 79900,
  currency: 'INR' as const,
  label: '₹799 · 10 reports',
}

export async function getCreditAccount(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<'workspaces'>,
) {
  return await ctx.db
    .query('creditAccounts')
    .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
    .unique()
}

// Accounts are created lazily (workspaces predating the credit system get one
// on first use) and start with the free grant, so a missing account always
// means "full free balance still available".
export async function ensureCreditAccount(
  ctx: MutationCtx,
  workspaceId: Id<'workspaces'>,
): Promise<Doc<'creditAccounts'>> {
  const existing = await getCreditAccount(ctx, workspaceId)
  if (existing) return existing

  const timestamp = now()
  const accountId = await ctx.db.insert('creditAccounts', {
    uuid: uuid(),
    workspaceId,
    balance: FREE_REPORT_CREDITS,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await ctx.db.insert('creditLedger', {
    uuid: uuid(),
    workspaceId,
    delta: FREE_REPORT_CREDITS,
    balanceAfter: FREE_REPORT_CREDITS,
    reason: 'signup_grant',
    createdAt: timestamp,
  })
  const account = await ctx.db.get(accountId)
  if (!account) throw new Error('Failed to create credit account')
  return account
}

export async function adjustCredits(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<'workspaces'>
    delta: number
    reason: Doc<'creditLedger'>['reason']
    paymentId?: Id<'payments'>
    userId?: Id<'users'>
  },
) {
  const account = await ensureCreditAccount(ctx, args.workspaceId)
  const balanceAfter = account.balance + args.delta

  if (balanceAfter < 0) {
    throw new ConvexError('NO_CREDITS')
  }

  const timestamp = now()
  await ctx.db.patch(account._id, {
    balance: balanceAfter,
    updatedAt: timestamp,
  })
  await ctx.db.insert('creditLedger', {
    uuid: uuid(),
    workspaceId: args.workspaceId,
    delta: args.delta,
    balanceAfter,
    reason: args.reason,
    paymentId: args.paymentId,
    userId: args.userId,
    createdAt: timestamp,
  })

  return balanceAfter
}
