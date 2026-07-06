import { Database, Construction } from 'lucide-react'

export default function KhoDuLieuPage() {
  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Database className="text-blue-600" />
          Kho dữ liệu tập trung
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Kho lưu trữ dữ liệu tập trung của toàn hệ thống.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white px-10 py-16 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
            <Construction size={32} />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">Đang phát triển</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Chức năng kho dữ liệu tập trung sẽ sớm được cập nhật.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
