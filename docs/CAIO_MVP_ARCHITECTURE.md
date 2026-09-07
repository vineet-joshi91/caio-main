# CAIO MVP Architecture

## 1. Overall System Architecture

CAIO is a multi-tenant TanStack Start application backed by Convex. TanStack Start owns the React UI, server functions, R2 upload signing, and streaming AI HTTP boundaries. Convex owns tenant data, RBAC checks, metadata, message history, business memory, audit versions, and the Convex RAG component.

Tenant isolation is enforced by `workspaceId` on every workspace-owned entity and by shared helpers in `convex/lib/rbac.ts`. All public Convex functions first resolve the authenticated user, then verify workspace membership and minimum role before reading or writing workspace records.

## 2. Folder Structure

```txt
convex/
  convex.config.ts          # Convex component registration, including Convex RAG
  schema.ts                 # Normalized CAIO schema
  users.ts                  # Authenticated user profile sync/read
  workspaces.ts             # Workspace and membership functions
  documents.ts              # Document metadata and chunk functions
  conversations.ts          # Conversation/message persistence
  memory.ts                 # Business profile and memory facts
  audits.ts                 # Audit and audit version persistence
  ai.ts                     # RAG/memory action boundaries
  lib/
    auth.ts                 # Auth identity helpers
    ids.ts                  # UUID/time helpers
    rbac.ts                 # Workspace role enforcement
src/
  components/ui/            # Local shadcn-style primitives
  routes/                   # TanStack Router pages
  server/
    ai/prompts.ts           # Advisor and audit prompt builders
    functions/              # TanStack Start server functions
    storage/r2.ts           # Cloudflare R2 presigned URL adapter
```

## 3. Database Schema

Convex tables mirror the requested normalized entities:

- `users`: UUID, auth subject, email/name/avatar.
- `workspaces`: UUID, business name, slug, owner.
- `memberships`: workspace/user role membership.
- `documents`: workspace file metadata, R2 key, status, RAG entry id.
- `documentChunks`: extracted workspace chunks and citation labels.
- `conversations`: workspace chat threads.
- `messages`: workspace messages with citation metadata.
- `businessProfiles`: editable structured workspace profile.
- `memoryFacts`: long-term facts, decisions, goals, assumptions, preferences, recurring discussions.
- `audits`: audit family per workspace.
- `auditVersions`: immutable versioned audit outputs with current/outdated status.

Convex native document IDs are retained for relations. Each table also has a `uuid` field to satisfy stable UUID identifier requirements.

## 4. API/Server Function Specification

Convex functions:

- Auth/user: `users.me`, `users.ensureCurrentUser`, `users.getById`.
- Workspace: `workspaces.listMine`, `workspaces.create`, `workspaces.update`, `workspaces.listMembers`, `workspaces.setMemberRole`.
- Documents: `documents.list`, `documents.createUploadRecord`, `documents.updateStatus`, `documents.replaceChunks`, `documents.remove`.
- Conversation: `conversations.list`, `conversations.create`, `conversations.messages`, `conversations.addMessage`.
- Business profile/memory: `memory.getBusinessProfile`, `memory.updateBusinessProfile`, `memory.listFacts`, `memory.upsertFact`, `memory.deactivateFact`.
- Audits: `audits.list`, `audits.createVersion`.
- AI/RAG boundaries: `ai.retrieveWorkspaceContext`, `ai.extractMemoryCandidates`.

TanStack Start server functions:

- `createDocumentUpload`: validates upload intent and returns a Cloudflare R2 presigned PUT URL.
- `streamAdvisorResponse`: streams model output through TanStack AI and the configured provider.

## 5. Authentication Flow

Convex Auth should provide the authenticated identity on `ctx.auth.getUserIdentity()`. On first authenticated load, the client calls `users.ensureCurrentUser` to create or update the CAIO `users` profile record. Workspace functions require that profile record and reject anonymous access.

Owner/admin/member permissions are enforced in Convex, not in React. UI state can hide actions, but server-side RBAC remains authoritative.

## 6. Document Ingestion Pipeline

1. Owner/admin requests an upload URL through `createDocumentUpload`.
2. Browser uploads the original file directly to R2 using the presigned URL.
3. Client creates a `documents` record with status `uploading`.
4. Processing action downloads the R2 object, extracts text, chunks it, and writes chunks.
5. Convex RAG indexes text into the workspace namespace.
6. Document status becomes `ready` or `failed`.
7. When a document becomes ready, current audit versions in that workspace are marked `outdated`.

MVP extraction starts with TXT/Markdown/CSV text paths; PDF/DOCX/PPTX/XLSX extractors can be added behind the same processing boundary.

## 7. RAG Pipeline

1. Persist user message.
2. Search Convex RAG within namespace `workspace:${workspaceId}`.
3. Read active memory facts and business profile for the same workspace.
4. Build an advisor system prompt from corpus context and business memory.
5. Stream the response through TanStack AI.
6. Persist assistant response with citation metadata.
7. Run a conservative memory extraction pass after the conversation turn.

## 8. Business Memory Design

Corpus memory is immutable document-derived context stored in R2, `documents`, `documentChunks`, and Convex RAG. It changes only when documents change.

Business memory is structured and editable:

- `businessProfiles` stores the current summary, industry, business model, target customers, goals, and constraints.
- `memoryFacts` stores discrete facts by type, confidence, source conversation, and active status.

Owners/admins can later edit, deactivate, or correct memory facts without changing source documents.

## 9. Audit Engine Flow

1. Owner/admin clicks Run Audit.
2. Server retrieves workspace profile, memory facts, and relevant corpus chunks.
3. LLM produces structured JSON with scores, strengths, weaknesses, recommendations, and citations.
4. Convex creates a new `auditVersions` row.
5. Previous current versions for that audit are marked `outdated`.
6. The parent `audits.latestVersionId` points to the new version.

Document updates mark existing current audit versions outdated but do not rerun audits automatically.

## 10. UI Page Hierarchy

- `/`: MVP dashboard shell.
- Sidebar: workspace switcher, Documents, Chat, Audit, Settings.
- Documents panel: upload button, filename, status, upload date.
- Chat panel: message stream, citations, composer.
- Audit panel: latest score, section scores, outdated warning, Run Audit button.
- Settings panel: workspace details, members, business profile.

## 11. Implementation Roadmap

1. Install and configure Convex Auth package.
2. Run Convex codegen after registering Convex RAG.
3. Connect dashboard data to Convex queries/mutations.
4. Finish document upload flow: presign, R2 PUT, document record creation.
5. Add text extraction for TXT, Markdown, and CSV.
6. Wire Convex RAG indexing for processed chunks.
7. Implement chat endpoint with retrieval, memory, streaming, persistence, and citations.
8. Implement memory extraction and owner/admin memory editing UI.
9. Implement audit generation with structured output validation.
10. Add tests for RBAC, workspace isolation, document status transitions, and audit outdated behavior.
11. Add production observability for ingestion failures and AI request errors.
