import { useState } from 'react'
import mammoth from 'mammoth'
import { docsApi } from '../api/docs'

export interface DocumentPreviewState {
  isOpen: boolean
  isLoading: boolean
  title: string
  content: string // HTML for DOCX, URL for PDF/TXT, or plain text
  fileType: 'pdf' | 'docx' | 'txt' | 'other'
  docId: string
}

function getFileTypeFromMime(mimeType: string): 'pdf' | 'docx' | 'txt' | 'other' {
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('vnd.openxmlformats-officedocument.wordprocessingml.document')) return 'docx'
  if (mimeType.includes('text/plain')) return 'txt'
  return 'other'
}

function getFileTypeFromName(fileName: string): 'pdf' | 'docx' | 'txt' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'txt') return 'txt'
  return 'other'
}

export function useDocumentPreview() {
  const [preview, setPreview] = useState<DocumentPreviewState>({
    isOpen: false,
    isLoading: false,
    title: '',
    content: '',
    fileType: 'other',
    docId: '',
  })

  const openPreview = async (
    docId: string,
    title: string,
    originalName?: string,
    mimeType?: string,
  ) => {
    setPreview((prev) => ({ ...prev, isOpen: true, isLoading: true, title }))

    try {
      const blob = await docsApi.fetchBlob(docId)
      let fileType = 'other'
      if (mimeType) {
        fileType = getFileTypeFromMime(mimeType)
      } else if (originalName) {
        fileType = getFileTypeFromName(originalName)
      }

      if (fileType === 'docx') {
        const arrayBuffer = await blob.arrayBuffer()
        const result = await mammoth.convertToHtml({ arrayBuffer })
        setPreview({
          isOpen: true,
          isLoading: false,
          title,
          content: result.value,
          fileType: 'docx',
          docId,
        })
      } else if (fileType === 'pdf') {
        const url = URL.createObjectURL(blob)
        setPreview({
          isOpen: true,
          isLoading: false,
          title,
          content: url,
          fileType: 'pdf',
          docId,
        })
      } else if (fileType === 'txt') {
        const text = await blob.text()
        setPreview({
          isOpen: true,
          isLoading: false,
          title,
          content: text,
          fileType: 'txt',
          docId,
        })
      } else {
        // For other formats, show a link or a message
        const url = URL.createObjectURL(blob)
        setPreview({
          isOpen: true,
          isLoading: false,
          title,
          content: url,
          fileType: 'other',
          docId,
        })
      }
    } catch (err) {
      setPreview((prev) => ({
        ...prev,
        isLoading: false,
        content: 'Không thể tải tài liệu này. Vui lòng tải xuống để xem.',
      }))
    }
  }

  const closePreview = () => {
    // Revoke object URLs if needed
    if (preview.fileType === 'pdf' || preview.fileType === 'other') {
      URL.revokeObjectURL(preview.content)
    }
    setPreview({
      isOpen: false,
      isLoading: false,
      title: '',
      content: '',
      fileType: 'other',
      docId: '',
    })
  }

  return { preview, openPreview, closePreview }
}
