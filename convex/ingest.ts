'use node'

import { v } from 'convex/values'
import { defaultChunker } from '@convex-dev/rag'
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { rag, workspaceNamespace } from './rag'

const TEXT_MIME_PREFIXES = ['text/']
const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/csv',
  'application/x-ndjson',
])

function isPlainText(mimeType: string, filename: string) {
  if (TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) {
    return true
  }
  if (TEXT_MIME_TYPES.has(mimeType)) return true
  return /\.(txt|md|markdown|csv|tsv|json|log|xml|html?)$/i.test(filename)
}

async function extractText(
  blob: Blob,
  mimeType: string,
  filename: string,
): Promise<string> {
  if (mimeType === 'application/pdf' || /\.pdf$/i.test(filename)) {
    const { extractText: extractPdfText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()))
    const { text } = await extractPdfText(pdf, { mergePages: true })
    return text
  }

  if (
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.docx$/i.test(filename)
  ) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(await blob.arrayBuffer()),
    })
    return result.value
  }

  if (isPlainText(mimeType, filename)) {
    const raw = await blob.text()
    if (/\.html?$/i.test(filename) || mimeType === 'text/html') {
      return raw
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
    }
    return raw
  }

  throw new Error(
    `Unsupported file type "${mimeType}". Supported: PDF, DOCX, TXT, Markdown, CSV, JSON, HTML.`,
  )
}

export const processDocument = internalAction({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(internal.documents.internalGet, {
      documentId: args.documentId,
    })
    if (!document) return null

    try {
      if (!document.storageId) {
        throw new Error('Document has no stored file')
      }

      const blob = await ctx.storage.get(document.storageId)
      if (!blob) {
        throw new Error('Uploaded file was not found in storage')
      }

      const text = (
        await extractText(blob, document.mimeType, document.filename)
      ).trim()

      if (!text) {
        throw new Error('No text could be extracted from this file')
      }

      const chunks = defaultChunker(text)

      await ctx.runMutation(internal.documents.internalReplaceChunks, {
        documentId: args.documentId,
        chunks,
      })

      // Index into the workspace RAG namespace. Reusing the document uuid as
      // the key means re-processing replaces the previous entry atomically.
      const { entryId } = await rag.add(ctx, {
        namespace: workspaceNamespace(document.workspaceId),
        key: document.uuid,
        title: document.filename,
        chunks,
      })

      await ctx.runMutation(internal.documents.internalSetStatus, {
        documentId: args.documentId,
        status: 'ready',
        ragEntryId: entryId,
        extractedTextPreview: text.slice(0, 500),
      })
    } catch (error) {
      await ctx.runMutation(internal.documents.internalSetStatus, {
        documentId: args.documentId,
        status: 'failed',
        statusReason:
          error instanceof Error ? error.message : 'Document processing failed',
      })
    }

    return null
  },
})
