import { ConvexError, v } from 'convex/values'
import { action, internalMutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { requireUser } from './lib/auth'
import { now, uuid } from './lib/ids'
import { requireRole } from './lib/rbac'
import {
  FREE_REPORT_CREDITS,
  REPORT_PACK,
  adjustCredits,
  getCreditAccount,
} from './lib/credits'

// Razorpay integration. The dashboard keys live in the Convex deployment
// environment: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.

function razorpayKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw new Error(
      'Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the Convex deployment.',
    )
  }
  return { keyId, keySecret }
}

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message),
  )
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// The credit balance itself is deliberately not exposed to the UI; the client
// only learns whether a report can run right now.
export const status = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await requireRole(ctx, args.workspaceId, user._id, 'member')

    const account = await getCreditAccount(ctx, args.workspaceId)
    const balance = account?.balance ?? FREE_REPORT_CREDITS

    return {
      canRunReport: balance > 0,
      pack: {
        credits: REPORT_PACK.credits,
        amountPaise: REPORT_PACK.amountPaise,
        currency: REPORT_PACK.currency,
      },
    }
  },
})

export const createOrder = action({
  args: { workspaceId: v.id('workspaces') },
  handler: async (
    ctx,
    args,
  ): Promise<{
    orderId: string
    amountPaise: number
    currency: string
    keyId: string
    credits: number
  }> => {
    const access = await ctx.runQuery(internal.guards.workspaceAccess, {
      workspaceId: args.workspaceId,
    })
    if (!access) {
      throw new Error('Workspace access denied')
    }
    if (access.role !== 'owner' && access.role !== 'admin') {
      throw new Error('Insufficient workspace permissions')
    }

    const { keyId, keySecret } = razorpayKeys()
    const receipt = uuid()

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: REPORT_PACK.amountPaise,
        currency: REPORT_PACK.currency,
        receipt,
        notes: { workspaceId: args.workspaceId },
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Razorpay order creation failed', response.status, detail)
      throw new Error('Could not start the payment. Please try again.')
    }

    const order = (await response.json()) as { id: string }

    await ctx.runMutation(internal.billing.recordOrder, {
      workspaceId: args.workspaceId,
      userId: access.userId,
      razorpayOrderId: order.id,
      amount: REPORT_PACK.amountPaise,
      currency: REPORT_PACK.currency,
      credits: REPORT_PACK.credits,
    })

    return {
      orderId: order.id,
      amountPaise: REPORT_PACK.amountPaise,
      currency: REPORT_PACK.currency,
      keyId,
      credits: REPORT_PACK.credits,
    }
  },
})

export const verifyPayment = action({
  args: {
    workspaceId: v.id('workspaces'),
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.string(),
  },
  handler: async (ctx, args): Promise<{ credited: boolean }> => {
    const access = await ctx.runQuery(internal.guards.workspaceAccess, {
      workspaceId: args.workspaceId,
    })
    if (!access) {
      throw new Error('Workspace access denied')
    }

    const { keySecret } = razorpayKeys()
    const expected = await hmacSha256Hex(
      keySecret,
      `${args.razorpayOrderId}|${args.razorpayPaymentId}`,
    )

    if (expected !== args.razorpaySignature) {
      await ctx.runMutation(internal.billing.markFailed, {
        razorpayOrderId: args.razorpayOrderId,
        reason: 'Signature verification failed',
      })
      throw new ConvexError('PAYMENT_VERIFICATION_FAILED')
    }

    const credited: boolean = await ctx.runMutation(
      internal.billing.applyPayment,
      {
        razorpayOrderId: args.razorpayOrderId,
        razorpayPaymentId: args.razorpayPaymentId,
      },
    )

    return { credited }
  },
})

export const recordOrder = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
    razorpayOrderId: v.string(),
    amount: v.number(),
    currency: v.string(),
    credits: v.number(),
  },
  handler: async (ctx, args) => {
    const timestamp = now()
    await ctx.db.insert('payments', {
      uuid: uuid(),
      workspaceId: args.workspaceId,
      userId: args.userId,
      provider: 'razorpay',
      razorpayOrderId: args.razorpayOrderId,
      amount: args.amount,
      currency: args.currency,
      credits: args.credits,
      status: 'created',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  },
})

// Idempotent: verifying the same payment twice only credits once.
export const applyPayment = internalMutation({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_order', (q) =>
        q.eq('razorpayOrderId', args.razorpayOrderId),
      )
      .unique()

    if (!payment) {
      throw new Error('Payment order not found')
    }
    if (payment.status === 'paid') {
      return false
    }

    await ctx.db.patch(payment._id, {
      status: 'paid',
      razorpayPaymentId: args.razorpayPaymentId,
      failureReason: undefined,
      updatedAt: now(),
    })

    await adjustCredits(ctx, {
      workspaceId: payment.workspaceId,
      delta: payment.credits,
      reason: 'purchase',
      paymentId: payment._id,
      userId: payment.userId,
    })

    return true
  },
})

export const markFailed = internalMutation({
  args: {
    razorpayOrderId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query('payments')
      .withIndex('by_order', (q) =>
        q.eq('razorpayOrderId', args.razorpayOrderId),
      )
      .unique()

    if (!payment || payment.status === 'paid') return

    await ctx.db.patch(payment._id, {
      status: 'failed',
      failureReason: args.reason,
      updatedAt: now(),
    })
  },
})

export const consumeReportCredit = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await adjustCredits(ctx, {
      workspaceId: args.workspaceId,
      delta: -1,
      reason: 'report',
      userId: args.userId,
    })
  },
})

export const refundReportCredit = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await adjustCredits(ctx, {
      workspaceId: args.workspaceId,
      delta: 1,
      reason: 'refund',
      userId: args.userId,
    })
  },
})
