export interface ChatCitationDto {
  doc_id: string
  chunk_id: string
  title: string
  page?: number
  snippet: string
  source: string
  section_path?: string
  /** Full chunk text used as LLM grounding context. Stripped before sending to the client. */
  text?: string
}

/** Stub retrieval fallback when RAG engine is unavailable. */
export function resolveCitations(query: string): ChatCitationDto[] {
  const q = query.toLowerCase()
  if (q.includes('thi') || q.includes('lịch') || q.includes('khảo thí') || q.includes('hk2')) {
    return [
      {
        doc_id: 'doc-khao-thi-qc',
        chunk_id: 'chunk-kt-18',
        title: 'Quy chế đào tạo & khảo thí chính quy (Trang 18)',
        page: 18,
        snippet: 'Lịch tổ chức thi học kỳ và quy định khảo thí.',
        source: 'Phòng Khảo thí',
      },
      {
        doc_id: 'doc-qd-482',
        chunk_id: 'chunk-qd-482',
        title: 'Quyết định số 482/QĐ-HV — Tổ chức thi học kỳ II 2025-2026',
        snippet: 'Kế hoạch tổ chức thi học kỳ II.',
        source: 'Văn phòng Học viện',
      },
    ]
  }
  if (q.includes('điểm') || q.includes('gpa') || q.includes('học lực') || q.includes('k65')) {
    return [
      {
        doc_id: 'doc-hoc-vu',
        chunk_id: 'chunk-hv-24',
        title: 'Sổ tay sinh viên & Quy định học vụ (Trang 24)',
        page: 24,
        snippet: 'Quy định xếp loại học lực và điểm trung bình.',
        source: 'Phòng Đào tạo',
      },
    ]
  }
  if (q.includes('tài liệu') || q.includes('học máy') || q.includes('giáo trình')) {
    return [
      {
        doc_id: 'doc-hm-dc',
        chunk_id: 'chunk-hm-1',
        title: 'Đề cương chi tiết môn Học máy ứng dụng',
        snippet: 'Mục tiêu môn học và tài liệu tham khảo.',
        source: 'Khoa CNTT',
      },
    ]
  }
  return [
    {
      doc_id: 'doc-edumind-kb',
      chunk_id: 'chunk-kb-general',
      title: 'Cơ sở tri thức tích hợp EduMind',
      snippet: 'Kho dữ liệu tập trung học viện.',
      source: 'Hệ thống Học viện',
    },
  ]
}
