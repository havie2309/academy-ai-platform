import { FileText, BookOpen } from 'lucide-react'
import type { ChatCitation } from '../api/chat'

interface CitationListProps {
  citations: ChatCitation[]
}

export default function CitationList({ citations }: CitationListProps) {
  if (!citations.length) return null
  const deduped = citations.filter((cit, idx, arr) => {
    const key = cit.doc_id?.trim().toLowerCase() || `${cit.title}|${cit.source}`.toLowerCase()
    return (
      idx ===
      arr.findIndex((x) => {
        const other = x.doc_id?.trim().toLowerCase() || `${x.title}|${x.source}`.toLowerCase()
        return other === key
      })
    )
  })

  return (
    <div className="mt-2 px-1">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wide">
        <BookOpen size={12} className="text-blue-500" />
        <span>Nguồn tham khảo</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {deduped.map((cit) => (
          <div
            key={`${cit.doc_id}-${cit.chunk_id}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50/50 hover:bg-blue-50 border border-blue-100/60 text-xs text-blue-700 font-medium transition-all max-w-full"
            title={cit.snippet}
          >
            <FileText size={12} className="text-blue-500 shrink-0" />
            <span className="truncate max-w-[180px] md:max-w-[240px]">{cit.title}</span>
            {cit.page != null && (
              <span className="text-[10px] bg-blue-100/70 px-1 py-0.5 rounded text-blue-600 shrink-0">
                tr.{cit.page}
              </span>
            )}
            <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-500 shrink-0">
              {cit.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
