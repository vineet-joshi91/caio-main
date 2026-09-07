# CAIO

CAIO is a document-grounded AI advisor for business workspaces. Upload your
company documents, get a scored business analysis, then manage a living
document + memory environment with a citation-backed advisor.

Stack: TanStack Start, React, TypeScript, TailwindCSS (light/dark), Convex
(data, auth, file storage, RAG), Vercel AI SDK (agentic chat + structured
audits), OpenRouter (LLM), OpenAI (embeddings only).

## Development

```bash
bun install
bun --bun run dev
```

Run Convex separately:

```bash
bunx --bun convex dev
```

## Required Environment

Copy `.env.example` to `.env.local` and set `VITE_CONVEX_URL`,
`VITE_CONVEX_SITE_URL`, and `CONVEX_DEPLOYMENT`.

In the **Convex deployment** environment (`bunx convex env set …`):

- `OPENROUTER_API_KEY` — chat, agentic tools, audit generation
- `OPENAI_API_KEY` — embeddings for Convex RAG
- `CAIO_CHAT_MODEL` — optional OpenRouter model slug (default `anthropic/claude-sonnet-4.5`)

## How it works

1. **Landing → Onboarding** (`/` → `/onboarding`): create a workspace, drag in
   documents (PDF, DOCX, TXT, MD, CSV, JSON, HTML).
2. **Ingestion** (`convex/ingest.ts`): files upload to Convex storage; a Node
   action extracts text, chunks it, stores chunks, and indexes them into the
   Convex RAG component under a per-workspace namespace.
3. **Analysis** (`convex/ai.ts#runAudit`): multi-probe RAG retrieval + business
   memory → `generateObject` produces a scored, versioned audit. New ready
   documents mark current audits outdated.
4. **Advisor chat** (`convex/http.ts#/api/chat`): a streaming HTTP action runs
   the Vercel AI SDK agent loop with `searchDocuments` (RAG) and
   `saveMemoryFact` (business memory) tools; messages + citations persist to
   Convex.

RBAC (owner/admin/member) is enforced server-side on every function; every
entity is scoped by `workspaceId`.

## Architecture

See [docs/CAIO_MVP_ARCHITECTURE.md](docs/CAIO_MVP_ARCHITECTURE.md).

## Scripts

```bash
bun --bun run build
bun --bun run test
bun --bun run lint
bun --bun run check
```
