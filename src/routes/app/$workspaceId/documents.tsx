import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { FileText, Trash2 } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { PageHeader, PageScroll } from '@/components/app/app-shell'
import { DocStatusBadge } from '@/components/app/doc-status'
import {
  UploadDropzone,
  useDocumentUpload,
} from '@/components/app/document-upload'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/app/$workspaceId/documents')({
  component: DocumentsPage,
})

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentsPage() {
  const { workspaceId } = Route.useParams()
  const wsId = workspaceId as Id<'workspaces'>

  const documents = useQuery(api.documents.list, { workspaceId: wsId })
  const removeDocument = useMutation(api.documents.remove)
  const { uploadFiles, uploading, error } = useDocumentUpload(wsId)

  return (
    <>
      <PageHeader
        description="Everything CAIO knows comes from here. Files are extracted, chunked, and indexed for retrieval."
        title="Documents"
      />
      <PageScroll>
        <div className="mx-auto max-w-4xl space-y-6">
          <UploadDropzone
            compact
            onFiles={(files) => void uploadFiles(files)}
            uploading={uploading}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents === undefined ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      Loading documents…
                    </TableCell>
                  </TableRow>
                ) : documents.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      No documents yet — upload your first file above.
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => (
                    <TableRow key={doc._id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <FileText
                            className="shrink-0 text-muted-foreground"
                            size={15}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {doc.filename}
                            </p>
                            {doc.status === 'failed' && doc.statusReason ? (
                              <p className="truncate text-xs text-destructive">
                                {doc.statusReason}
                              </p>
                            ) : doc.extractedTextPreview ? (
                              <p className="max-w-80 truncate text-xs text-muted-foreground">
                                {doc.extractedTextPreview}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DocStatusBadge status={doc.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatBytes(doc.byteSize)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <button
                          aria-label={`Delete ${doc.filename}`}
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() =>
                            void removeDocument({ documentId: doc._id })
                          }
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </PageScroll>
    </>
  )
}
