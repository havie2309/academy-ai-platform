import type { DocumentPreviewState } from '../hooks/useDocumentPreview'

interface DocumentPreviewModalProps {
  preview: DocumentPreviewState
  onClose: () => void
}

export default function DocumentPreviewModal({ preview, onClose }: DocumentPreviewModalProps) {
  if (!preview.isOpen) return null

  const renderContent = () => {
    if (preview.isLoading) {
      return (
        <div className="flex items-center justify-center py-12 text-slate-500">
          Đang tải…
        </div>
      )
    }

    switch (preview.fileType) {
      case 'docx':
        return (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: preview.content }}
          />
        )
      case 'pdf':
        return (
          <iframe src={preview.content} className="h-[70vh] w-full" title={preview.title} />
        )
      case 'txt':
        return (
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm font-mono">
            {preview.content}
          </pre>
        )
      default:
        return (
          <div className="text-slate-500">
            Không thể hiển thị tài liệu này. Vui lòng tải xuống để xem.
          </div>
        )
    }
  }

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
          <h3 className="text-lg font-semibold text-slate-800">
            {preview.title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        {renderContent()}
      </div>
    </div>
  )
}
