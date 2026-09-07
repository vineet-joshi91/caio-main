import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// All chat/agentic/audit generation goes through OpenRouter. Set
// OPENROUTER_API_KEY (and optionally CAIO_CHAT_MODEL) in the Convex
// deployment environment.
export function modelSlug() {
  return process.env.CAIO_CHAT_MODEL ?? 'anthropic/claude-sonnet-4.5'
}

export function chatModel() {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  })
  return openrouter.chat(modelSlug())
}

// Not every OpenRouter model supports tool calling (e.g. nex-agi/nex-n2-pro
// does not). The chat pipeline adapts: tool-capable models get agentic
// search/memory tools; others rely on up-front RAG injection plus a post-turn
// structured memory-extraction pass. Cached per isolate.
const toolSupportCache = new Map<string, boolean>()

export async function modelSupportsTools(): Promise<boolean> {
  const slug = modelSlug()
  const cached = toolSupportCache.get(slug)
  if (cached !== undefined) return cached

  try {
    const response = await fetch(
      `https://openrouter.ai/api/v1/models/${slug}/endpoints`,
    )
    if (!response.ok) return true // fail open: assume tools work
    const payload = (await response.json()) as {
      data?: {
        endpoints?: Array<{ supported_parameters?: Array<string> }>
      }
    }
    const supported = (payload.data?.endpoints ?? []).some((endpoint) =>
      (endpoint.supported_parameters ?? []).includes('tools'),
    )
    toolSupportCache.set(slug, supported)
    return supported
  } catch {
    return true
  }
}
