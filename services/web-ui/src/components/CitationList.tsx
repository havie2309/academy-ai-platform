import { BookOpen, FileText } from 'lucide-react'
import type { ChatCitation } from '../api/chat'

interface CitationListProps {
  citations: ChatCitation[]
  showScores?: boolean
  onCitationClick?: (citation: ChatCitation) => void
}

interface CitationGroup {
  key: string
  title: string
  source: string
  snippet: string
  pages: number[]
  sections: string[]
  matchCount: number
  rerankScore: number | null
}

function compactText(value: string | undefined, max = 180): string {
  const text = (value ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

function groupKey(citation: ChatCitation): string {
  const docId = citation.doc_id?.trim().toLowerCase()
  if (docId) return `doc:${docId}`
  return `title:${citation.title.trim().toLowerCase()}|source:${citation.source.trim().toLowerCase()}`
}

function normalizeSection(sectionPath: string | undefined): string {
  if (!sectionPath) return ''
  const parts = sectionPath
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length <= 2) return parts.join(' > ')
  return parts.slice(-2).join(' > ')
}

function formatPages(pages: number[]): string {
  if (!pages.length) return ''
  const unique = [...new Set(pages)].sort((a, b) => a - b)
  if (unique.length === 1) return `tr.${unique[0]}`
  return `tr.${unique[0]}-${unique[unique.length - 1]}`
}

function buildGroups(citations: ChatCitation[]): CitationGroup[] {
  const groups = new Map<string, CitationGroup>()

  for (const citation of citations) {
    const key = groupKey(citation)
    const section = normalizeSection(citation.section_path)
    const snippet = compactText(citation.snippet)
    const title = citation.title.trim() || 'Tài liệu'
    const source = citation.source.trim()
    const rerankScore = citation.rerank_score != null ? Number(citation.rerank_score) : null

    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        key,
        title,
        source,
        snippet,
        pages: citation.page != null ? [citation.page] : [],
        sections: section ? [section] : [],
        matchCount: 1,
        rerankScore,
      })
      continue
    }

    existing.matchCount += 1
    if (!existing.snippet && snippet) existing.snippet = snippet
    if (citation.page != null && !existing.pages.includes(citation.page)) {
      existing.pages.push(citation.page)
    }
    if (section && !existing.sections.includes(section)) {
      existing.sections.push(section)
    }
    // Keep highest rerank score
    if (rerankScore != null) {
      if (existing.rerankScore == null || rerankScore > existing.rerankScore) {
        existing.rerankScore = rerankScore
      }
    }
  }

  return [...groups.values()]
}

export default function CitationList({
  citations,
  showScores = false,
  onCitationClick,
}: CitationListProps) {
  if (!citations.length) return null

  let groups = buildGroups(citations)

  // If showing scores, sort groups by rerankScore descending (highest first)
  if (showScores) {
    groups = groups.sort((a, b) => {
      const aScore = a.rerankScore ?? -Infinity
      const bScore = b.rerankScore ?? -Infinity
      return bScore - aScore
    })
  }

  const handleCardClick = (group: CitationGroup) => {
    if (!onCitationClick) return
    const originalCitation = citations.find((c) => groupKey(c) === group.key)
    if (originalCitation) {
      onCitationClick(originalCitation)
    }
  }

  return (
    <div className="mt-2 px-1" data-testid="citation-list">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
        <BookOpen size={12} className="text-blue-500" />
        <span>Nguồn dùng để trả lời</span>
      </div>

      <div className="grid gap-2">
        {groups.map((group) => {
          const pageLabel = formatPages(group.pages)
          const showSource =
            !!group.source &&
            group.source.trim().toLowerCase() !== group.title.trim().toLowerCase()

          const scoreDisplay = showScores && group.rerankScore != null
            ? group.rerankScore.toFixed(2)
            : null

          return (
            <div
              key={group.key}
              data-testid="citation-card"
              onClick={() => handleCardClick(group)}
              onKeyDown={(e) => e.key === 'Enter' && handleCardClick(group)}
              role="button"
              tabIndex={0}
              className="cursor-pointer rounded-xl border border-blue-100/80 bg-gradient-to-br from-blue-50/80 to-white px-3 py-2.5 text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <FileText size={13} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="min-w-0 text-xs font-semibold leading-snug text-slate-700">
                      {group.title}
                    </span>

                    {scoreDisplay && (
                      <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        {scoreDisplay}
                      </span>
                    )}

                    {pageLabel && (
                      <span className="shrink-0 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        {pageLabel}
                      </span>
                    )}

                    {group.matchCount > 1 && (
                      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        {group.matchCount} đoạn liên quan
                      </span>
                    )}
                  </div>

                  {showSource && (
                    <div className="mt-1 text-[11px] font-medium text-slate-500">
                      {group.source}
                    </div>
                  )}

                  {group.sections.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {group.sections.slice(0, 2).map((section) => (
                        <span
                          key={section}
                          className="rounded-md border border-slate-200 bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {section}
                        </span>
                      ))}

                      {group.sections.length > 2 && (
                        <span className="rounded-md border border-slate-200 bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          +{group.sections.length - 2} mục
                        </span>
                      )}
                    </div>
                  )}

                  {group.snippet && (
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                      {group.snippet}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
