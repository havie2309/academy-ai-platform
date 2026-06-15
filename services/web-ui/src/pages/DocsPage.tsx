import { useState } from 'react'
import { Search, FileText, Download, ExternalLink, Filter, BookOpen, Upload, FolderOpen } from 'lucide-react'

const mockDocs = [
  { id: '1', title: 'Quy chế đào tạo trình độ đại học mới nhất', category: 'Quy chế', type: 'PDF', size: '2.4 MB', date: '12/01/2026', author: 'Phòng Đào tạo' },
  { id: '2', title: 'Hướng dẫn đăng ký học phần & sử dụng Cổng thông tin', category: 'Quy chế', type: 'PDF', size: '1.8 MB', date: '15/02/2026', author: 'Phòng Công tác Sinh viên' },
  { id: '3', title: 'Đề cương chi tiết môn học Học máy ứng dụng', category: 'Tài liệu môn học', type: 'DOCX', size: '540 KB', date: '08/01/2026', author: 'Khoa CNTT' },
  { id: '4', title: 'Giáo trình Cơ sở dữ liệu và SQL nâng cao', category: 'Tài liệu môn học', type: 'PDF', size: '12.6 MB', date: '20/12/2025', author: 'Bộ môn Hệ thống thông tin' },
  { id: '5', title: 'Lịch thi học kỳ II năm học 2025 - 2026 (Chính thức)', category: 'Lịch thi', type: 'PDF', size: '1.2 MB', date: '10/06/2026', author: 'Phòng Khảo thí' },
  { id: '6', title: 'Đề cương ôn tập kiểm tra giữa kỳ môn Vật lý đại cương', category: 'Tài liệu môn học', type: 'PDF', size: '3.1 MB', date: '05/03/2026', author: 'Khoa Khoa học cơ bản' },
]

const categories = ['Tất cả', 'Quy chế', 'Tài liệu môn học', 'Lịch thi']

export default function DocsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCat, setSelectedCat] = useState('Tất cả')

  const filteredDocs = mockDocs.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.author.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCat = selectedCat === 'Tất cả' || doc.category === selectedCat
    return matchesSearch && matchesCat
  })

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            Tài liệu & Học liệu
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tra cứu kho tài nguyên học tập và quy chế đào tạo nội bộ.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-72 shrink-0">
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)] transition-all text-slate-800 placeholder-slate-400 shadow-sm"
            />
            <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
          </div>
          <button
            type="button"
            disabled
            title="Tính năng upload sẽ có khi pipeline ingest sẵn sàng"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm font-semibold cursor-not-allowed border border-slate-200"
          >
            <Upload size={16} />
            Tải lên
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6 max-w-xl">
        {[
          { label: 'Tài liệu', value: mockDocs.length, icon: FileText },
          { label: 'Danh mục', value: categories.length - 1, icon: FolderOpen },
          { label: 'Kết quả lọc', value: filteredDocs.length, icon: Filter },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white border border-slate-200/60 rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Icon size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-xl font-extrabold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCat(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              selectedCat === cat
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredDocs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200/60 transition-all group"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                  <FileText size={20} />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wide">
                  {doc.type}
                </span>
              </div>

              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">{doc.category}</span>
              <h3 className="text-slate-800 font-bold text-sm leading-snug group-hover:text-blue-600 transition-colors line-clamp-2 mb-3 min-h-[40px]">
                {doc.title}
              </h3>

              <div className="space-y-1.5 mb-5 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Phát hành</span>
                  <span className="font-semibold text-slate-600">{doc.author}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ngày tạo</span>
                  <span className="font-semibold text-slate-600">{doc.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dung lượng</span>
                  <span className="font-semibold text-slate-600">{doc.size}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-auto pt-3 border-t border-slate-100">
                <button
                  type="button"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-all cursor-pointer"
                >
                  <ExternalLink size={12} />
                  Xem online
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all cursor-pointer"
                >
                  <Download size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white border border-slate-200/60 rounded-2xl shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-3">
            <Filter size={20} />
          </div>
          <p className="text-slate-600 font-bold text-sm">Không tìm thấy tài liệu phù hợp</p>
          <p className="text-slate-400 text-xs mt-1">Thử đổi từ khóa hoặc danh mục bộ lọc.</p>
        </div>
      )}
    </div>
  )
}
