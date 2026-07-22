import { useState } from 'react'
import mammoth from 'mammoth'
import { docsApi } from '../api/docs'

export interface DocumentPreviewChunk {
  id: string
  text: string
  index: number
  section_path: string | null
  page: number | null
}

export type PreviewMode = 'original' | 'markdown'

export interface DocumentPreviewState {
  isOpen: boolean
  isLoading: boolean
  title: string
  docId: string
  mode: PreviewMode

  // For 'original' mode (DocsPage)
  originalContent?: string // HTML for DOCX, URL for PDF, plain text for TXT
  fileType?: 'pdf' | 'docx' | 'txt' | 'markdown' | 'other'
  originalName?: string

  // For 'markdown' mode (ChatPage – citations)
  chunks?: DocumentPreviewChunk[]
  highlightChunkIds?: string[]
  error?: string
}

function getFileTypeFromMime(mimeType: string): 'pdf' | 'docx' | 'txt' | 'markdown' | 'other' {
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('vnd.openxmlformats-officedocument.wordprocessingml.document')) return 'docx'
  if (mimeType.includes('text/plain')) return 'txt'
  if (mimeType.includes('text/markdown')) return 'markdown'
  return 'other'
}

function getFileTypeFromName(fileName: string): 'pdf' | 'docx' | 'txt' | 'markdown' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'txt') return 'txt'
  if (ext === 'md') return 'markdown'
  return 'other'
}

export function useDocumentPreview() {
  const [preview, setPreview] = useState<DocumentPreviewState>({
    isOpen: false,
    isLoading: false,
    title: '',
    docId: '',
    mode: 'original',
  })

  const openPreview = async (
    docId: string,
    title: string,
    originalName?: string,
    mimeType?: string,
    chunkId?: string, // If provided, use markdown mode
  ) => {
    // Reset state and open
    setPreview({
      isOpen: true,
      isLoading: true,
      title,
      docId,
      mode: chunkId ? 'markdown' : 'original',
      ...(chunkId ? { highlightChunkIds: [chunkId] } : {}),
    })

    try {
      // ---- MARKDOWN MODE (for citations) ----
      if (chunkId) {
        const data = await docsApi.getChunks(docId, 1000, 'parent')
        if (data.chunks.length === 0) {
          setPreview((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Không có nội dung để hiển thị.',
          }))
          return
        }
        const sorted = data.chunks.sort((a, b) => b.index - a.index)
        setPreview((prev) => ({
          ...prev,
          isLoading: false,
          chunks: sorted,
          highlightChunkIds: [chunkId],
        }))
        return
      }

      // ---- ORIGINAL MODE (for DocsPage) ----
      const blob = await docsApi.fetchBlob(docId)

      // Determine file type
      let fileType: 'pdf' | 'docx' | 'txt' | 'markdown' | 'other' = 'other'
      if (mimeType) {
        fileType = getFileTypeFromMime(mimeType)
      } else if (originalName) {
        fileType = getFileTypeFromName(originalName)
      }

      if (fileType === 'docx') {
        const arrayBuffer = await blob.arrayBuffer()
        const result = await mammoth.convertToHtml({ arrayBuffer })
        setPreview((prev) => ({
          ...prev,
          isLoading: false,
          mode: 'original',
          originalContent: result.value,
          fileType: 'docx',
          originalName,
        }))
      } else if (fileType === 'pdf') {
        const url = URL.createObjectURL(blob)
        setPreview((prev) => ({
          ...prev,
          isLoading: false,
          mode: 'original',
          originalContent: url,
          fileType: 'pdf',
          originalName,
        }))
      } else if (fileType === 'txt') {
        const text = await blob.text()
        setPreview((prev) => ({
          ...prev,
          isLoading: false,
          mode: 'original',
          originalContent: text,
          fileType: 'txt',
          originalName,
        }))
      } else if (fileType === 'markdown') {
        const text = await blob.text()
        setPreview((prev) => ({
          ...prev,
          isLoading: false,
          mode: 'original',
          originalContent: text,
          fileType: 'markdown',
          originalName,
        }))
        return
      } else {
        // Unknown format: show a message
        setPreview((prev) => ({
          ...prev,
          isLoading: false,
          mode: 'original',
          originalContent: '',
          fileType: 'other',
          originalName,
          error: 'Không thể hiển thị tài liệu này. Vui lòng tải xuống để xem.',
        }))
      }
    } catch (err) {
      setPreview((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Không thể tải tài liệu này.',
      }))
    }
  }

  const closePreview = () => {
    // Revoke object URLs if needed (PDFs)
    if (preview.mode === 'original' && preview.fileType === 'pdf' && preview.originalContent) {
      URL.revokeObjectURL(preview.originalContent)
    }
    setPreview({
      isOpen: false,
      isLoading: false,
      title: '',
      docId: '',
      mode: 'original',
    })
  }

  return { preview, openPreview, closePreview }
}
