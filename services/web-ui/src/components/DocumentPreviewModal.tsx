import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import type { DocumentPreviewState } from '../hooks/useDocumentPreview'

interface DocumentPreviewModalProps {
  preview: DocumentPreviewState
  onClose: () => void
}

function renderOriginalContent(preview: DocumentPreviewState) {
  if (preview.isLoading) {
    return <div className="flex items-center justify-center py-12 text-slate-500">Đang tải…</div>
  }

  if (preview.error) {
    return <div className="text-red-500 text-sm">{preview.error}</div>
  }

  switch (preview.fileType) {
    case 'docx':
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: preview.originalContent || '' }}
        />
      )
    case 'pdf':
      return (
        <iframe
          src={preview.originalContent}
          className="h-[70vh] w-full"
          title={preview.title}
        />
      )
    case 'txt':
      return (
        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm font-mono">
          {preview.originalContent}
        </pre>
      )
    case 'markdown':
      return (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{preview.originalContent}</ReactMarkdown>
        </div>
      )
    default:
      return (
        <div className="text-slate-500">
          Không thể hiển thị tài liệu này. Vui lòng tải xuống để xem.
        </div>
      )
  }
}

function renderMarkdownContent(preview: DocumentPreviewState) {
  if (preview.isLoading) {
    return <div className="flex items-center justify-center py-12 text-slate-500">Đang tải…</div>
  }

  if (preview.error) {
    return <div className="text-red-500 text-sm">{preview.error}</div>
  }

  if (!preview.chunks || preview.chunks.length === 0) {
    return <div className="text-slate-500 text-sm">Không có nội dung để hiển thị.</div>
  }

  const highlightSet = new Set(preview.highlightChunkIds || [])

  // Combine chunks, wrapping highlighted ones in a div with the highlight class
  const combinedMarkdown = preview.chunks
    .map((chunk) => {
      const text = chunk.text || ''
      if (highlightSet.has(chunk.id)) {
        // Wrap the entire chunk in a div with highlight class
        return `<div class="highlight-block">${text}</div>`
      }
      return text
    })
    .join('\n\n') // Preserve paragraph separation

  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown rehypePlugins={[rehypeRaw]}>{combinedMarkdown}</ReactMarkdown>
    </div>
  )
}

export default function DocumentPreviewModal({ preview, onClose }: DocumentPreviewModalProps) {
  if (!preview.isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{preview.title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {preview.mode === 'markdown'
          ? renderMarkdownContent(preview)
          : renderOriginalContent(preview)}
      </div>
    </div>
  )
}

