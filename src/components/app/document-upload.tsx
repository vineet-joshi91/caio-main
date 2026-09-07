import { useCallback, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { UploadCloud } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { cn } from '@/lib/utils'

export const ACCEPTED_TYPES =
  '.pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.xml,.log'

export function useDocumentUpload(workspaceId: Id<'workspaces'> | null) {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl)
  const createUploadRecord = useMutation(api.documents.createUploadRecord)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFiles = useCallback(
    async (files: Array<File>) => {
      if (!workspaceId || files.length === 0) return
      setUploading(true)
      setError(null)

      try {
        for (const file of files) {
          const uploadUrl = await generateUploadUrl({ workspaceId })
          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
            body: file,
          })
          if (!response.ok) {
            throw new Error(`Upload failed for ${file.name}`)
          }
          const { storageId } = (await response.json()) as {
            storageId: Id<'_storage'>
          }
          await createUploadRecord({
            workspaceId,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            byteSize: file.size,
            storageId,
          })
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [workspaceId, generateUploadUrl, createUploadRecord],
  )

  return { uploadFiles, uploading, error }
}

export function UploadDropzone({
  onFiles,
  uploading,
  className,
  compact = false,
}: {
  onFiles: (files: Array<File>) => void
  uploading: boolean
  className?: string
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  return (
    <button
      className={cn(
        'grid w-full cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border bg-card/50 text-center transition-colors',
        dragOver && 'border-primary bg-primary/5',
        uploading && 'pointer-events-none opacity-60',
        compact ? 'p-6' : 'p-12',
        className,
      )}
      onClick={() => inputRef.current?.click()}
      onDragLeave={() => setDragOver(false)}
      onDragOver={(event) => {
        event.preventDefault()
        setDragOver(true)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragOver(false)
        onFiles([...event.dataTransfer.files])
      }}
      type="button"
    >
      <input
        accept={ACCEPTED_TYPES}
        className="hidden"
        multiple
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])])
          event.target.value = ''
        }}
        ref={inputRef}
        type="file"
      />
      <div className="space-y-2">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <UploadCloud size={22} />
        </div>
        <p className="text-sm font-medium">
          {uploading
            ? 'Uploading…'
            : 'Drop company documents here, or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, Markdown, CSV, JSON, HTML — business plans, financials,
          decks, SOPs
        </p>
      </div>
    </button>
  )
}
