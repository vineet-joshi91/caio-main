import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type DbCtx = QueryCtx | MutationCtx
type Role = Doc<'memberships'>['role']

const roleRank: Record<Role, number> = {
  member: 1,
  admin: 2,
  owner: 3,
}

export async function requireMembership(
  ctx: DbCtx,
  workspaceId: Id<'workspaces'>,
  userId: Id<'users'>,
) {
  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_workspace_user', (q) =>
      q.eq('workspaceId', workspaceId).eq('userId', userId),
    )
    .unique()

  if (!membership) {
    throw new Error('Workspace access denied')
  }

  return membership
}

export async function requireRole(
  ctx: DbCtx,
  workspaceId: Id<'workspaces'>,
  userId: Id<'users'>,
  minimumRole: Role,
) {
  const membership = await requireMembership(ctx, workspaceId, userId)

  if (roleRank[membership.role] < roleRank[minimumRole]) {
    throw new Error('Insufficient workspace permissions')
  }

  return membership
}
