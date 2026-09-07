import { httpRouter } from 'convex/server'
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
} from 'ai'
import type { UIMessage } from 'ai'
import { z } from 'zod'
import { getAuthUserId } from '@convex-dev/auth/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { auth } from './auth'
import { rag, workspaceNamespace } from './rag'
import { chatModel, modelSupportsTools } from './lib/llm'
import { advisorSystemPrompt, formatBusinessMemory } from './prompts'

const http = httpRouter()

auth.addHttpRoutes(http)

function corsHeaders(request: Request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

http.route({
  path: '/api/chat',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }),
})

http.route({
  path: '/api/chat',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const headers = corsHeaders(request)

    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return new Response('Unauthorized', { status: 401, headers })
    }

    const body = (await request.json()) as {
      workspaceId: Id<'workspaces'>
      conversationId: Id<'conversations'>
      messages: Array<UIMessage>
    }

    const access = await ctx.runQuery(internal.guards.workspaceAccess, {
      workspaceId: body.workspaceId,
    })
    if (!access) {
      return new Response('Workspace access denied', { status: 403, headers })
    }

    const context = await ctx.runQuery(internal.guards.chatContext, {
      workspaceId: body.workspaceId,
    })
    if (!context) {
      return new Response('Workspace not found', { status: 404, headers })
    }

    // Persist the incoming user message before streaming so history survives
    // interrupted streams.
    const lastMessage = body.messages.at(-1)
    let userText = ''
    if (lastMessage?.role === 'user') {
      userText = lastMessage.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
      if (userText) {
        await ctx.runMutation(internal.conversations.internalAddMessage, {
          conversationId: body.conversationId,
          role: 'user',
          content: userText,
        })
      }
    }

    const namespace = workspaceNamespace(body.workspaceId)
    const citations: Array<{ documentTitle: string; excerpt: string }> = []

    // Up-front retrieval on the user's message. This grounds every model —
    // including ones without tool support — and guarantees citations.
    let corpusContext = ''
    if (userText) {
      try {
        const { text, results, entries } = await rag.search(ctx, {
          namespace,
          query: userText.slice(0, 1000),
          limit: 6,
          vectorScoreThreshold: 0.1,
        })
        corpusContext = text
        const titles = new Map(
          entries.map((entry) => [entry.entryId, entry.title ?? 'Document']),
        )
        for (const item of results) {
          citations.push({
            documentTitle: titles.get(item.entryId) ?? 'Document',
            excerpt: item.content
              .map((chunk) => chunk.text)
              .join('\n')
              .slice(0, 240),
          })
        }
      } catch {
        // Retrieval failures (e.g. empty namespace) never block the chat.
      }
    }

    // Tool-capable models additionally get agentic search + memory tools;
    // others fall back to a post-turn structured memory extraction pass.
    const supportsTools = await modelSupportsTools()

    const result = streamText({
      model: chatModel(),
      system: advisorSystemPrompt({
        workspaceName: context.workspace.name,
        businessMemory: formatBusinessMemory(context.profile, context.facts),
        corpusContext,
        hasTools: supportsTools,
      }),
      messages: await convertToModelMessages(body.messages),
      stopWhen: stepCountIs(6),
      tools: supportsTools
        ? {
        searchDocuments: tool({
          description:
            "Semantic search over the company's uploaded documents. Use before answering questions about the business.",
          inputSchema: z.object({
            query: z.string().describe('What to look for in the documents'),
          }),
          execute: async ({ query }) => {
            const { text, results, entries } = await rag.search(ctx, {
              namespace,
              query,
              limit: 6,
              // Deliberately permissive: small corpora score low, and a weak
              // match still beats an unanswered question for grounding.
              vectorScoreThreshold: 0.1,
            })

            const titles = new Map(
              entries.map((entry) => [entry.entryId, entry.title ?? 'Document']),
            )
            for (const item of results) {
              citations.push({
                documentTitle: titles.get(item.entryId) ?? 'Document',
                excerpt: item.content
                  .map((chunk) => chunk.text)
                  .join('\n')
                  .slice(0, 240),
              })
            }

            return text || 'No relevant document context found.'
          },
        }),
        saveMemoryFact: tool({
          description:
            'Record a durable fact, decision, goal, assumption, or preference about the business. Use conservatively for clear, lasting information only.',
          inputSchema: z.object({
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
          execute: async ({ type, fact, confidence }) => {
            await ctx.runMutation(internal.memory.internalRecordFact, {
              workspaceId: body.workspaceId,
              type,
              fact,
              confidence,
              sourceConversationId: body.conversationId,
            })
            return `Recorded ${type}: ${fact}`
          },
        }),
      }
        : undefined,
      onFinish: async ({ text }) => {
        if (!text) return
        // Dedupe citations by title+excerpt before persisting.
        const unique = [
          ...new Map(
            citations.map((c) => [`${c.documentTitle}:${c.excerpt}`, c]),
          ).values(),
        ].slice(0, 12)

        await ctx.runMutation(internal.conversations.internalAddMessage, {
          conversationId: body.conversationId,
          role: 'assistant',
          content: text,
          citations: unique,
        })

        // Models without tool support can't call saveMemoryFact mid-stream;
        // run a conservative structured extraction pass on the exchange.
        if (!supportsTools && userText) {
          await ctx.scheduler.runAfter(0, internal.ai.extractMemoryFromExchange, {
            workspaceId: body.workspaceId,
            conversationId: body.conversationId,
            userText,
            assistantText: text,
          })
        }
      },
    })

    const response = result.toUIMessageStreamResponse({
      // Surface real provider errors to the client instead of the masked
      // "An error occurred." default — this is a dev tool, not a bank.
      onError: (error) => {
        console.error('chat stream error', error)
        return error instanceof Error ? error.message : String(error)
      },
    })
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    return response
  }),
})

export default http
