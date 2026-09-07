import { generateObject } from 'ai'
import { z } from 'zod'
import { v } from 'convex/values'
import { action, internalAction } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { rag, workspaceNamespace } from './rag'
import { chatModel } from './lib/llm'
import {
  REQUIRED_AUDIT_SECTIONS,
  auditInstructions,
  formatBusinessMemory,
} from './prompts'

export const retrieveWorkspaceContext = action({
  args: {
    workspaceId: v.id('workspaces'),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(internal.guards.workspaceAccess, {
      workspaceId: args.workspaceId,
    })
    if (!access) {
      throw new Error('Workspace access denied')
    }

    const { text, results, entries } = await rag.search(ctx, {
      namespace: workspaceNamespace(args.workspaceId),
      query: args.query,
      limit: args.limit ?? 8,
      vectorScoreThreshold: 0.1,
    })

    const entryTitles = new Map(
      entries.map((entry) => [entry.entryId, entry.title ?? 'Document']),
    )

    return {
      contextText: text,
      citations: results.map((result) => ({
        documentTitle: entryTitles.get(result.entryId) ?? 'Document',
        excerpt: result.content
          .map((chunk) => chunk.text)
          .join('\n')
          .slice(0, 300),
      })),
    }
  },
})

// Note: no zod .min()/.max() here — some OpenRouter upstreams (e.g. Bedrock)
// reject JSON Schema number bounds. Scores are clamped after generation.
const auditSchema = z.object({
  overallScore: z.number().describe('0-100'),
  consultingNeed: z
    .string()
    .describe(
      'Where hands-on expert consulting would most improve this business right now (2-4 sentences)',
    ),
  sectionScores: z.array(
    z.object({
      section: z.string(),
      score: z.number().describe('0-100'),
      rationale: z.string(),
    }),
  ),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
  citations: z.array(
    z.object({
      documentTitle: z.string(),
      excerpt: z.string(),
    }),
  ),
})

export const runAudit = action({
  args: {
    workspaceId: v.id('workspaces'),
    auditId: v.optional(v.id('audits')),
  },
  handler: async (ctx, args): Promise<{ versionId: string }> => {
    const access = await ctx.runQuery(internal.guards.workspaceAccess, {
      workspaceId: args.workspaceId,
    })
    if (!access) {
      throw new Error('Workspace access denied')
    }
    if (access.role !== 'owner' && access.role !== 'admin') {
      throw new Error('Insufficient workspace permissions')
    }

    const context = await ctx.runQuery(internal.guards.chatContext, {
      workspaceId: args.workspaceId,
    })
    if (!context) {
      throw new Error('Workspace not found')
    }

    // Each report consumes one credit. Consumed up-front so concurrent runs
    // can't overdraw; refunded below if generation fails.
    await ctx.runMutation(internal.billing.consumeReportCredit, {
      workspaceId: args.workspaceId,
      userId: access.userId,
    })

    try {
      return await generateAuditReport(ctx, args, context, access.userId)
    } catch (error) {
      await ctx.runMutation(internal.billing.refundReportCredit, {
        workspaceId: args.workspaceId,
        userId: access.userId,
      })
      throw error
    }
  },
})

async function generateAuditReport(
  ctx: ActionCtx,
  args: { workspaceId: Id<'workspaces'>; auditId?: Id<'audits'> },
  context: {
    workspace: Doc<'workspaces'>
    profile: Doc<'businessProfiles'> | null
    facts: Array<Doc<'memoryFacts'>>
  },
  userId: Id<'users'>,
): Promise<{ versionId: string }> {
  // Pull a broad slice of the corpus for the audit. Multiple probe queries
  // give better section coverage than a single embedding lookup.
  const probes = [
    'revenue model current revenue growth pricing customers paying',
    'business strategy market positioning',
    'financials costs budget cash flow',
    'operations processes team hiring execution',
    'marketing sales customers acquisition growth',
    'product roadmap features technology risks',
  ]

  const seen = new Set<string>()
  const corpusParts: Array<string> = []
  for (const probe of probes) {
    const { text, entries } = await rag.search(ctx, {
      namespace: workspaceNamespace(args.workspaceId),
      query: probe,
      limit: 6,
      vectorScoreThreshold: 0.2,
    })
    for (const entry of entries) {
      if (entry.title) seen.add(entry.title)
    }
    if (text) corpusParts.push(text)
  }

  const corpus = corpusParts.join('\n\n---\n\n').slice(0, 60_000)
  const businessMemory = formatBusinessMemory(context.profile, context.facts)

  const { object } = await generateObject({
    model: chatModel(),
    schema: auditSchema,
    system: auditInstructions(context.workspace.name),
    prompt: [
      'Business memory:',
      businessMemory || '(none recorded)',
      '',
      `Documents available: ${[...seen].join(', ') || '(none)'}`,
      '',
      'Document corpus:',
      corpus || '(no documents have been indexed yet)',
    ].join('\n'),
  })

  const clamp = (score: number) => Math.max(0, Math.min(100, score))

  const versionId = await ctx.runMutation(internal.audits.internalCreateVersion, {
    workspaceId: args.workspaceId,
    auditId: args.auditId,
    name: 'Business Audit',
    overallScore: clamp(object.overallScore),
    consultingNeed: object.consultingNeed,
    sectionScores: normalizeSections(object.sectionScores).map((section) => ({
      ...section,
      score: clamp(section.score),
    })),
    strengths: object.strengths,
    weaknesses: object.weaknesses,
    recommendations: object.recommendations,
    citations: object.citations,
    createdByUserId: userId,
  })

  return { versionId }
}

// Guarantees the common factors (Revenue first) appear in every report, in a
// stable order, even if the model strays from the instructed section list.
function normalizeSections(
  sections: Array<{ section: string; score: number; rationale: string }>,
) {
  const remaining = [...sections]
  const ordered: typeof sections = []

  for (const required of REQUIRED_AUDIT_SECTIONS) {
    const index = remaining.findIndex(
      (candidate) =>
        candidate.section.trim().toLowerCase() === required.toLowerCase(),
    )
    if (index >= 0) {
      const [match] = remaining.splice(index, 1)
      ordered.push({ ...match, section: required })
    } else {
      ordered.push({
        section: required,
        score: 0,
        rationale:
          'Not enough evidence in the document corpus to assess this factor. Add relevant documents and re-run the audit.',
      })
    }
  }

  return [...ordered, ...remaining]
}

const memoryExtractionSchema = z.object({
  facts: z.array(
    z.object({
      type: z.enum([
        'company_fact',
        'decision',
        'goal',
        'assumption',
        'preference',
        'recurring_discussion',
      ]),
      fact: z.string(),
      confidence: z.number().describe('0 to 1'),
    }),
  ),
})

// Post-turn memory extraction for chat models that lack tool support.
// Scheduled from the /api/chat HTTP action after the response finishes.
export const extractMemoryFromExchange = internalAction({
  args: {
    workspaceId: v.id('workspaces'),
    conversationId: v.id('conversations'),
    userText: v.string(),
    assistantText: v.string(),
  },
  handler: async (ctx, args) => {
    const { object } = await generateObject({
      model: chatModel(),
      schema: memoryExtractionSchema,
      system: [
        'You extract durable business memory from a conversation exchange.',
        'Only record clear, lasting facts, decisions, goals, assumptions, or preferences ABOUT THE BUSINESS that the user stated or confirmed.',
        'Do NOT record questions, speculation, assistant suggestions the user did not confirm, or transient details.',
        'Return an empty list when nothing qualifies — that is the common case.',
      ].join('\n'),
      prompt: [
        'User message:',
        args.userText.slice(0, 4000),
        '',
        'Assistant reply:',
        args.assistantText.slice(0, 4000),
      ].join('\n'),
    })

    for (const candidate of object.facts.slice(0, 5)) {
      if (candidate.confidence < 0.6) continue
      await ctx.runMutation(internal.memory.internalRecordFact, {
        workspaceId: args.workspaceId,
        type: candidate.type,
        fact: candidate.fact,
        confidence: candidate.confidence,
        sourceConversationId: args.conversationId,
      })
    }

    return null
  },
})
