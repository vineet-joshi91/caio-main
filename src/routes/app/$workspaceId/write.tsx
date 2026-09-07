import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Streamdown } from 'streamdown'
import {
  Bold,
  Code,
  Eye,
  Heading2,
  ImagePlus,
  Italic,
  List,
  Loader2,
  PenLine,
  Plus,
  Quote,
  Save,
  Trash2,
} from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { PageHeader } from '@/components/app/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/app/$workspaceId/write')({
  component: WritePage,
})

function WritePage() {
  const { workspaceId } = Route.useParams()
  const wsId = workspaceId as Id<'workspaces'>

  const notes = useQuery(api.notes.list, { workspaceId: wsId })
  const createNote = useMutation(api.notes.create)
  const updateNote = useMutation(api.notes.update)
  const removeNote = useMutation(api.notes.remove)

  const [selectedId, setSelectedId] = useState<Id<'notes'> | null>(null)
  const note = useQuery(
    api.notes.get,
    selectedId ? { noteId: selectedId } : 'skip',
  )

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the selected note into the editor (only when switching notes, so
  // in-progress edits are not clobbered by reactive updates).
  const loadedIdRef = useRef<Id<'notes'> | null>(null)
  useEffect(() => {
    if (selectedId === null) {
      loadedIdRef.current = null
      return
    }
    if (note && loadedIdRef.current !== note._id) {
      loadedIdRef.current = note._id
      setTitle(note.title)
      setContent(note.content)
      setDirty(false)
    }
  }, [note, selectedId])

  function startNew() {
    setSelectedId(null)
    loadedIdRef.current = null
    setTitle('')
    setContent('')
    setDirty(false)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (selectedId) {
        await updateNote({ noteId: selectedId, title, content })
      } else {
        const noteId = await createNote({ workspaceId: wsId, title, content })
        setSelectedId(noteId)
        loadedIdRef.current = noteId
      }
      setDirty(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedId) return
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    await removeNote({ noteId: selectedId })
    startNew()
  }

  return (
    <>
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            {selectedId ? (
              <Button
                onClick={() => void handleDelete()}
                size="sm"
                variant="secondary"
              >
                <Trash2 className="mr-1.5" size={14} />
                Delete
              </Button>
            ) : null}
            <Button
              disabled={saving || (!dirty && selectedId !== null)}
              onClick={() => void handleSave()}
              size="sm"
            >
              {saving ? (
                <Loader2 className="mr-1.5 animate-spin" size={14} />
              ) : (
                <Save className="mr-1.5" size={14} />
              )}
              {selectedId ? 'Save' : 'Create'}
            </Button>
          </div>
        }
        description="Write documents directly on the platform — they join your corpus like uploads."
        title="Write"
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden min-h-0 flex-col border-r border-border lg:flex">
          <div className="border-b border-border p-3">
            <Button
              className="w-full"
              onClick={startNew}
              size="sm"
              variant="secondary"
            >
              <Plus className="mr-1.5" size={14} />
              New document
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {(notes ?? []).map((item) => (
              <button
                className={cn(
                  'w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent',
                  selectedId === item._id && 'bg-accent',
                )}
                key={item._id}
                onClick={() => {
                  setSelectedId(item._id)
                  setError(null)
                }}
                type="button"
              >
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {new Date(item.updatedAt).toLocaleDateString()} ·{' '}
                  {item.preview.replace(/[#*_`>![\]()]/g, '').trim() ||
                    'Empty'}
                </p>
              </button>
            ))}
            {notes && notes.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Nothing written yet.
              </p>
            ) : null}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">
          {error ? (
            <div className="mx-4 mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          <MarkdownEditor
            content={content}
            onChangeContent={(value) => {
              setContent(value)
              setDirty(true)
            }}
            onChangeTitle={(value) => {
              setTitle(value)
              setDirty(true)
            }}
            title={title}
            workspaceId={wsId}
          />
        </div>
      </div>
    </>
  )
}

function MarkdownEditor({
  title,
  content,
  onChangeTitle,
  onChangeContent,
  workspaceId,
}: {
  title: string
  content: string
  onChangeTitle: (value: string) => void
  onChangeContent: (value: string) => void
  workspaceId: Id<'workspaces'>
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [uploadingImage, setUploadingImage] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const generateImageUploadUrl = useMutation(api.notes.generateImageUploadUrl)
  const resolveImageUrl = useMutation(api.notes.resolveImageUrl)

  function insertAtSelection(before: string, after = '', placeholder = '') {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.slice(start, end) || placeholder
    const next =
      content.slice(0, start) + before + selected + after + content.slice(end)
    onChangeContent(next)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      )
    })
  }

  function insertBlock(prefix: string, placeholder: string) {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const needsNewline = start > 0 && content[start - 1] !== '\n'
    insertAtSelection((needsNewline ? '\n\n' : '') + prefix, '', placeholder)
  }

  async function handleImageFile(file: File) {
    setUploadingImage(true)
    try {
      const uploadUrl = await generateImageUploadUrl({ workspaceId })
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'image/png' },
        body: file,
      })
      if (!response.ok) throw new Error('Image upload failed')
      const { storageId } = (await response.json()) as {
        storageId: Id<'_storage'>
      }
      const url = await resolveImageUrl({ workspaceId, storageId })
      const alt = file.name.replace(/\.[a-z0-9]+$/i, '')
      insertBlock(`![${alt}](${url})\n`, '')
    } finally {
      setUploadingImage(false)
    }
  }

  const tools = [
    {
      icon: Bold,
      label: 'Bold',
      action: () => insertAtSelection('**', '**', 'bold text'),
    },
    {
      icon: Italic,
      label: 'Italic',
      action: () => insertAtSelection('_', '_', 'italic text'),
    },
    {
      icon: Heading2,
      label: 'Heading',
      action: () => insertBlock('## ', 'Heading'),
    },
    {
      icon: List,
      label: 'List',
      action: () => insertBlock('- ', 'List item'),
    },
    {
      icon: Quote,
      label: 'Quote',
      action: () => insertBlock('> ', 'Quote'),
    },
    {
      icon: Code,
      label: 'Code',
      action: () => insertAtSelection('`', '`', 'code'),
    },
  ] as const

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <Input
        className="mb-3 border-none px-1 text-lg font-bold shadow-none focus-visible:ring-0"
        onChange={(event) => onChangeTitle(event.target.value)}
        placeholder="Document title…"
        value={title}
      />

      <div className="mb-3 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
        {tools.map((tool) => (
          <button
            aria-label={tool.label}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            disabled={mode === 'preview'}
            key={tool.label}
            onClick={tool.action}
            title={tool.label}
            type="button"
          >
            <tool.icon size={15} />
          </button>
        ))}
        <button
          aria-label="Insert image"
          className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          disabled={mode === 'preview' || uploadingImage}
          onClick={() => imageInputRef.current?.click()}
          title="Insert image"
          type="button"
        >
          {uploadingImage ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <ImagePlus size={15} />
          )}
        </button>
        <input
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleImageFile(file)
            event.target.value = ''
          }}
          ref={imageInputRef}
          type="file"
        />

        <div className="ml-auto flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          {(
            [
              ['write', 'Write', PenLine],
              ['preview', 'Preview', Eye],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              className={cn(
                'flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium text-muted-foreground transition-colors',
                mode === value && 'bg-background text-foreground shadow-sm',
              )}
              key={value}
              onClick={() => setMode(value)}
              type="button"
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'write' ? (
        <textarea
          className="min-h-0 flex-1 resize-none rounded-xl border border-border bg-card p-4 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => onChangeContent(event.target.value)}
          placeholder="Write in markdown — plans, SOPs, meeting notes, anything the advisor should know…"
          ref={textareaRef}
          value={content}
        />
      ) : (
        <div className="prose prose-sm dark:prose-invert min-h-0 max-w-none flex-1 overflow-y-auto rounded-xl border border-border bg-card p-6">
          {content.trim() ? (
            <Streamdown>{content}</Streamdown>
          ) : (
            <p className="text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
