import { useEffect, useState } from 'react'
import { LayoutDashboard, Users, MessageSquare, CheckCircle, Database, TrendingUp, Server, AlertCircle } from 'lucide-react'
import { authApi, fetchGatewayHealth, type GatewayHealth } from '../api/auth'

const stats = [
  { label: 'Học viên hoạt động', value: '1,248', change: '+12%', sub: 'so với tuần trước', icon: Users, color: 'text-blue-600 bg-blue-50' },
  { label: 'Tổng số câu hỏi', value: '45,210', change: '+8.4%', sub: 'trung bình 842/ngày', icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'Độ chính xác RAG', value: '96.8%', change: '+0.5%', sub: 'đã kiểm định khảo thí', icon: CheckCircle, color: 'text-indigo-600 bg-indigo-50' },
  { label: 'Tài liệu tích hợp', value: '148', change: '+5 tài liệu', sub: 'cập nhật 2 giờ trước', icon: Database, color: 'text-amber-600 bg-amber-50' },
]

const recentQueries = [
  { student: 'Nguyễn Văn An (K65-CNTT)', query: 'Thời hạn đóng học phí học kỳ II là khi nào?', time: '5 phút trước', status: 'Đã trả lời', rating: 'Tốt' },
  { student: 'Lê Thị Hà (K64-Luật)', query: 'Điểm chuẩn xét tuyển song ngành năm nay bao nhiêu?', time: '12 phút trước', status: 'Đã trả lời', rating: 'Tốt' },
  { student: 'Trần Minh Hoàng (K65-KHMT)', query: 'Môn Học máy ứng dụng có thi thực hành không?', time: '20 phút trước', status: 'Đã trả lời', rating: 'Chưa đánh giá' },
  { student: 'Phạm Thanh Thảo (K63-QTKD)', query: 'Quy trình xin bảo lưu kết quả học tập?', time: '1 giờ trước', status: 'Đã trả lời', rating: 'Trung bình' },
]

const topics = [
  { name: 'Quy chế đào tạo & Học vụ', percent: 45, count: 20344, color: 'bg-blue-600' },
  { name: 'Lịch thi & Địa điểm thi', percent: 30, count: 13563, color: 'bg-indigo-600' },
  { name: 'Tài liệu môn học & Giáo trình', percent: 15, count: 6781, color: 'bg-emerald-600' },
  { name: 'Học phí & Học bổng', percent: 10, count: 4521, color: 'bg-amber-600' },
]

const weeklyActivity = [
  { day: 'T2', value: 45 },
  { day: 'T3', value: 65 },
  { day: 'T4', value: 85 },
  { day: 'T5', value: 70 },
  { day: 'T6', value: 90 },
  { day: 'T7', value: 50 },
  { day: 'CN', value: 30 },
]

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
  )
}

export default function AdminPage() {
  const user = authApi.getUser()
  const [health, setHealth] = useState<GatewayHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)

  useEffect(() => {
    fetchGatewayHealth()
      .then(setHealth)
      .finally(() => setHealthLoading(false))
  }, [])

  const gatewayUp = health?.status === 'ok' || health?.status === 'degraded'
  const userMgmtUp = health?.upstream.userManagement === 'up'
  const chatUp = health?.upstream.chat === 'up'

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="text-blue-600" />
            Dashboard Giáo dục
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Xin chào {user?.full_name ?? 'Admin'} — theo dõi hoạt động trợ lý ảo và hệ thống.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
            <AlertCircle size={14} />
            <span>Số liệu demo</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8 max-w-3xl">
        <div className="flex items-center gap-3 bg-white border border-slate-200/60 rounded-xl px-4 py-3 shadow-sm">
          <Server size={18} className="text-blue-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">API Gateway</p>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusDot ok={!healthLoading && gatewayUp} />
              <span className="text-sm font-semibold text-slate-700">
                {healthLoading ? 'Đang kiểm tra…' : gatewayUp ? 'Hoạt động' : 'Lỗi'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200/60 rounded-xl px-4 py-3 shadow-sm">
          <Server size={18} className="text-indigo-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">User Management</p>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusDot ok={!healthLoading && userMgmtUp} />
              <span className="text-sm font-semibold text-slate-700">
                {healthLoading ? 'Đang kiểm tra…' : userMgmtUp ? 'Hoạt động' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200/60 rounded-xl px-4 py-3 shadow-sm">
          <Server size={18} className="text-emerald-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Chat Service</p>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusDot ok={!healthLoading && chatUp} />
              <span className="text-sm font-semibold text-slate-700">
                {healthLoading ? 'Đang kiểm tra…' : chatUp ? 'Hoạt động' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map(({ label, value, change, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{value}</span>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
                <TrendingUp size={12} />
                {change}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-extrabold text-slate-800 mb-4 uppercase tracking-wider">Chủ đề học viên quan tâm</h3>
          <div className="space-y-4">
            {topics.map((topic) => (
              <div key={topic.name}>
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
                  <span>{topic.name}</span>
                  <span className="text-slate-400">{topic.count.toLocaleString()} lượt ({topic.percent}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full ${topic.color}`} style={{ width: `${topic.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-800 mb-4 uppercase tracking-wider">Tần suất hỏi trong tuần</h3>
          <div className="flex items-end justify-between h-40 pt-4 px-2">
            {weeklyActivity.map((activity) => (
              <div key={activity.day} className="flex flex-col items-center gap-2 w-full">
                <div
                  className="w-6 bg-gradient-to-t from-blue-500 to-blue-600 rounded-t-md hover:opacity-90 transition-all"
                  style={{ height: `${activity.value * 1.2}px` }}
                />
                <span className="text-[11px] font-bold text-slate-400">{activity.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Lịch sử câu hỏi gần đây</h3>
          <button type="button" className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer">
            Xem tất cả
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-5">Học viên</th>
                <th className="py-3 px-5">Câu hỏi</th>
                <th className="py-3 px-5">Thời gian</th>
                <th className="py-3 px-5">Trạng thái</th>
                <th className="py-3 px-5 text-right">Đánh giá</th>
              </tr>
            </thead>
            <tbody>
              {recentQueries.map((q, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors text-slate-600">
                  <td className="py-3.5 px-5 font-semibold text-slate-800 whitespace-nowrap">{q.student}</td>
                  <td className="py-3.5 px-5 truncate max-w-[280px]">{q.query}</td>
                  <td className="py-3.5 px-5 text-slate-400 text-xs whitespace-nowrap">{q.time}</td>
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {q.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <span
                      className={`inline-block text-[11px] font-bold ${
                        q.rating === 'Tốt'
                          ? 'text-emerald-600'
                          : q.rating === 'Trung bình'
                            ? 'text-amber-500'
                            : 'text-slate-400'
                      }`}
                    >
                      {q.rating}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
