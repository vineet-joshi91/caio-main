import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useAuthToken } from '@convex-dev/auth/react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import {
  BookOpenText,
  Brain,
  Loader2,
  MessageSquareText,
  Plus,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { Streamdown } from 'streamdown'
import { api } from '../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/$workspaceId/chat')({
  component: ChatPage,
})

function chatEndpoint() {
  const site = (import.meta as any).env.VITE_CONVEX_SITE_URL as
    | string
    | undefined
  if (site) return `${site.replace(/\/$/, '')}/api/chat`
  const cloud = (import.meta as any).env.VITE_CONVEX_URL as string
  return `${cloud.replace('.convex.cloud', '.convex.site')}/api/chat`
}

function ChatPage() {
  const { workspaceId } = Route.useParams()
  const wsId = workspaceId as Id<'workspaces'>

  const conversations = useQuery(api.conversations.list, { workspaceId: wsId })
  const createConversation = useMutation(api.conversations.create)
  const [selectedId, setSelectedId] = useState<Id<'conversations'> | null>(null)

  // Auto-select the most recent conversation once loaded.
  useEffect(() => {
    if (!selectedId && conversations && conversations.length > 0) {
      setSelectedId(conversations[0]._id)
    }
  }, [conversations, selectedId])

  async function handleNewConversation() {
    const id = await createConversation({ workspaceId: wsId })
    setSelectedId(id)
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Conversation list */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Conversations
          </p>
          <button
            aria-label="New conversation"
            className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => void handleNewConversation()}
            type="button"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {(conversations ?? []).map((conversation) => (
            <button
              className={cn(
                'block w-full truncate rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                conversation._id === selectedId &&
                  'bg-accent font-medium text-accent-foreground',
              )}
              key={conversation._id}
              onClick={() => setSelectedId(conversation._id)}
              type="button"
            >
              {conversation.title}
            </button>
          ))}
          {conversations && conversations.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              No conversations yet.
            </p>
          ) : null}
        </div>
      </aside>

      {/* Chat pane */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedId ? (
          <ConversationLoader
            conversationId={selectedId}
            key={selectedId}
            workspaceId={wsId}
          />
        ) : (
          <EmptyChatState
            loaded={conversations !== undefined}
            onStart={() => void handleNewConversation()}
          />
        )}
      </div>
    </div>
  )
}

function EmptyChatState({
  onStart,
  loaded,
}: {
  onStart: () => void
  loaded: boolean
}) {
  return (
    <div className="grid flex-1 place-items-center p-8">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <MessageSquareText size={26} />
        </div>
        <h2 className="display-title text-2xl font-bold">
          Ask your advisor anything
        </h2>
        <p className="text-sm text-muted-foreground">
          CAIO answers from your uploaded documents with citations, and
          remembers the durable facts, goals, and decisions you share.
        </p>
        {loaded ? (
          <Button onClick={onStart}>
            <Plus className="mr-2" size={16} />
            Start a conversation
          </Button>
        ) : (
          <Loader2 className="mx-auto animate-spin text-muted-foreground" size={18} />
        )}
      </div>
    </div>
  )
}

function ConversationLoader({
  workspaceId,
  conversationId,
}: {
  workspaceId: Id<'workspaces'>
  conversationId: Id<'conversations'>
}) {
  const token = useAuthToken()
  const stored = useQuery(api.conversations.messages, { conversationId })

  if (stored === undefined || !token) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="animate-spin text-muted-foreground" size={18} />
      </div>
    )
  }

  const initialMessages: Array<UIMessage> = stored
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      id: message._id,
      role: message.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: message.content }],
      metadata: { citations: message.citations },
    }))

  return (
    <ChatSession
      conversationId={conversationId}
      initialMessages={initialMessages}
      token={token}
      workspaceId={workspaceId}
    />
  )
}

type StoredCitations = Doc<'messages'>['citations']

function ChatSession({
  workspaceId,
  conversationId,
  initialMessages,
  token,
}: {
  workspaceId: Id<'workspaces'>
  conversationId: Id<'conversations'>
  initialMessages: Array<UIMessage>
  token: string
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: chatEndpoint(),
        headers: { Authorization: `Bearer ${token}` },
        body: { workspaceId, conversationId },
      }),
    [workspaceId, conversationId, token],
  )

  const { messages, sendMessage, status, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
  })

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  function handleSend() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    void sendMessage({ text })
  }

  return (
    <>
      {/* Messages — the scrolling region; composer stays pinned below */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Ask about strategy, finances, operations — CAIO will search your
              documents before answering.
            </div>
          ) : null}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {status === 'submitted' ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" size={14} />
              Thinking…
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message.includes('OPENROUTER')
                ? 'The AI provider is not configured yet. Set OPENROUTER_API_KEY in the Convex deployment.'
                : `Something went wrong: ${error.message}`}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-card/50 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            aria-label="Message"
            className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask your advisor… (Enter to send, Shift+Enter for a new line)"
            rows={1}
            value={input}
          />
          <Button
            aria-label="Send message"
            className="h-11 w-11 shrink-0 rounded-xl p-0"
            disabled={!input.trim() || busy}
            onClick={handleSend}
          >
            {busy ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user'
  const citations =
    (message.metadata as { citations?: StoredCitations } | undefined)
      ?.citations ?? []

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-xl',
          isUser
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-primary text-primary-foreground',
        )}
      >
        {isUser ? (
          <span className="text-xs font-bold">You</span>
        ) : (
          <ShieldCheck size={15} />
        )}
      </div>

      <div
        className={cn(
          'min-w-0 max-w-[85%] space-y-2',
          isUser && 'flex flex-col items-end',
        )}
      >
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            return isUser ? (
              <div
                className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                key={index}
              >
                <p className="whitespace-pre-wrap">{part.text}</p>
              </div>
            ) : (
              <div
                className="prose prose-sm max-w-none rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 dark:prose-invert"
                key={index}
              >
                <Streamdown>{part.text}</Streamdown>
              </div>
            )
          }

          if (part.type === 'tool-searchDocuments') {
            const query =
              part.state === 'input-streaming'
                ? '…'
                : ((part.input as { query?: string } | undefined)?.query ?? '')
            return (
              <div
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
                key={index}
              >
                {part.state === 'output-available' ? (
                  <BookOpenText size={12} />
                ) : (
                  <Search className="animate-pulse" size={12} />
                )}
                {part.state === 'output-available'
                  ? `Searched documents: “${query}”`
                  : `Searching documents: “${query}”`}
              </div>
            )
          }

          if (part.type === 'tool-saveMemoryFact') {
            const fact = (part.input as { fact?: string } | undefined)?.fact
            return (
              <div
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground"
                key={index}
              >
                <Brain size={12} />
                {fact ? `Remembered: ${fact}` : 'Updating business memory…'}
              </div>
            )
          }

          return null
        })}

        {citations.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {citations.slice(0, 6).map((citation, index) => (
              <span
                className="inline-flex max-w-64 items-center gap-1 truncate rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground"
                key={index}
                title={citation.excerpt}
              >
                <BookOpenText className="shrink-0" size={10} />
                {citation.documentTitle}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
