import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

export const workspaceRole = v.union(
  v.literal('owner'),
  v.literal('admin'),
  v.literal('member'),
)

export const documentStatus = v.union(
  v.literal('uploading'),
  v.literal('processing'),
  v.literal('ready'),
  v.literal('failed'),
)

export const messageRole = v.union(
  v.literal('user'),
  v.literal('assistant'),
  v.literal('system'),
)

export const memoryFactType = v.union(
  v.literal('company_fact'),
  v.literal('decision'),
  v.literal('goal'),
  v.literal('assumption'),
  v.literal('preference'),
  v.literal('recurring_discussion'),
)

export default defineSchema({
  users: defineTable({
    uuid: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index('by_uuid', ['uuid'])
    .index('email', ['email'])
    .index('phone', ['phone']),

  authSessions: authTables.authSessions,
  authAccounts: authTables.authAccounts,
  authRefreshTokens: authTables.authRefreshTokens,
  authVerificationCodes: authTables.authVerificationCodes,
  authVerifiers: authTables.authVerifiers,
  authRateLimits: authTables.authRateLimits,

  workspaces: defineTable({
    uuid: v.string(),
    name: v.string(),
    slug: v.string(),
    ownerUserId: v.id('users'),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_uuid', ['uuid'])
    .index('by_slug', ['slug'])
    .index('by_owner', ['ownerUserId']),

  memberships: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
    role: workspaceRole,
    invitedEmail: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_user', ['userId'])
    .index('by_workspace_user', ['workspaceId', 'userId']),

  documents: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    uploadedByUserId: v.id('users'),
    filename: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
    storageId: v.optional(v.id('_storage')),
    r2Key: v.optional(v.string()),
    r2Bucket: v.optional(v.string()),
    status: documentStatus,
    statusReason: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    ragEntryId: v.optional(v.string()),
    extractedTextPreview: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_uuid', ['uuid'])
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_status', ['workspaceId', 'status']),

  documentChunks: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    documentId: v.id('documents'),
    chunkIndex: v.number(),
    text: v.string(),
    tokenCount: v.optional(v.number()),
    citationLabel: v.string(),
    ragChunkId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_document', ['documentId'])
    .index('by_document_index', ['documentId', 'chunkIndex']),

  conversations: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    createdByUserId: v.id('users'),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_uuid', ['uuid'])
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_updated', ['workspaceId', 'updatedAt']),

  messages: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    conversationId: v.id('conversations'),
    role: messageRole,
    content: v.string(),
    citations: v.array(
      v.object({
        documentId: v.optional(v.id('documents')),
        documentTitle: v.string(),
        chunkId: v.optional(v.id('documentChunks')),
        excerpt: v.string(),
      }),
    ),
    createdAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_conversation', ['conversationId'])
    .index('by_conversation_created', ['conversationId', 'createdAt']),

  businessProfiles: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    summary: v.string(),
    industry: v.optional(v.string()),
    businessModel: v.optional(v.string()),
    targetCustomers: v.optional(v.string()),
    goals: v.array(v.string()),
    constraints: v.array(v.string()),
    updatedByUserId: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_uuid', ['uuid'])
    .index('by_workspace', ['workspaceId']),

  memoryFacts: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    type: memoryFactType,
    fact: v.string(),
    sourceConversationId: v.optional(v.id('conversations')),
    confidence: v.number(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_type', ['workspaceId', 'type'])
    .index('by_workspace_active', ['workspaceId', 'active']),

  notes: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    createdByUserId: v.id('users'),
    title: v.string(),
    content: v.string(),
    ragEntryId: v.optional(v.string()),
    indexedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_uuid', ['uuid'])
    .index('by_workspace', ['workspaceId'])
    .index('by_workspace_updated', ['workspaceId', 'updatedAt']),

  creditAccounts: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    balance: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_workspace', ['workspaceId']),

  creditLedger: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    delta: v.number(),
    balanceAfter: v.number(),
    reason: v.union(
      v.literal('signup_grant'),
      v.literal('purchase'),
      v.literal('report'),
      v.literal('refund'),
    ),
    paymentId: v.optional(v.id('payments')),
    userId: v.optional(v.id('users')),
    createdAt: v.number(),
  }).index('by_workspace', ['workspaceId']),

  payments: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    userId: v.id('users'),
    provider: v.literal('razorpay'),
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    credits: v.number(),
    status: v.union(
      v.literal('created'),
      v.literal('paid'),
      v.literal('failed'),
    ),
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_order', ['razorpayOrderId']),

  audits: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    name: v.string(),
    latestVersionId: v.optional(v.id('auditVersions')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_uuid', ['uuid'])
    .index('by_workspace', ['workspaceId']),

  auditVersions: defineTable({
    uuid: v.string(),
    workspaceId: v.id('workspaces'),
    auditId: v.id('audits'),
    version: v.number(),
    status: v.union(v.literal('current'), v.literal('outdated')),
    overallScore: v.number(),
    consultingNeed: v.optional(v.string()),
    sectionScores: v.array(
      v.object({
        section: v.string(),
        score: v.number(),
        rationale: v.string(),
      }),
    ),
    strengths: v.array(v.string()),
    weaknesses: v.array(v.string()),
    recommendations: v.array(v.string()),
    citations: v.array(
      v.object({
        documentId: v.optional(v.id('documents')),
        documentTitle: v.string(),
        excerpt: v.string(),
      }),
    ),
    createdByUserId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_workspace', ['workspaceId'])
    .index('by_audit', ['auditId'])
    .index('by_audit_version', ['auditId', 'version'])
    .index('by_workspace_status', ['workspaceId', 'status']),
})
