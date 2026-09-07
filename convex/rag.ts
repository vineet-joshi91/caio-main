import { RAG } from '@convex-dev/rag'
import { openai } from '@ai-sdk/openai'
import { components } from './_generated/api'
import type { Id } from './_generated/dataModel'

// Convex RAG component instance. Embeddings use OpenAI directly because
// OpenRouter does not expose an embeddings endpoint; chat/agentic calls go
// through OpenRouter (see lib/llm.ts).
export const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding('text-embedding-3-small'),
  embeddingDimension: 1536,
})

export function workspaceNamespace(workspaceId: Id<'workspaces'>) {
  return `workspace:${workspaceId}`
}
