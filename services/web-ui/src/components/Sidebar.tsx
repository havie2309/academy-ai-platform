import { MessageSquare, FileText, LayoutDashboard, Settings, Plus } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

const history = ['Hỏi về lịch thi HK2', 'Điểm trung bình lớp K65', 'Tài liệu môn Học máy']

const bottomNav = [
  { icon: FileText, label: 'Tài liệu', href: '/docs' },
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
  { icon: Settings, label: 'Cài đặt', href: '/settings' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="w-60 shrink-0 flex flex-col h-full bg-[#171717] border-r border-white/5">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <MessageSquare size={14} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Academy AI</p>
            <p className="text-white/40 text-[11px]">Trợ lý ảo nội bộ</p>
          </div>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 pb-3">
        <button
          onClick={() => navigate('/chat')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white/70 hover:text-white text-sm transition-all"
        >
          <Plus size={15} />
          Cuộc trò chuyện mới
        </button>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto px-2">
        <p className="text-white/30 text-[11px] font-medium px-2 py-2 uppercase tracking-wider">Gần đây</p>
        {history.map((item) => (
          <button
            key={item}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-white/60 hover:text-white/90 truncate transition-all block"
          >
            {item}
          </button>
        ))}
      </div>

      {/* Bottom Nav */}
      <div className="px-2 pb-2 border-t border-white/5 pt-2">
        {bottomNav.map(({ icon: Icon, label, href }) => (
          <button
            key={href}
            onClick={() => navigate(href)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              location.pathname === href
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* User */}
      <div className="px-3 py-3 border-t border-white/5">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium leading-tight truncate">Admin</p>
            <p className="text-white/40 text-[11px] truncate">admin@academy.edu</p>
          </div>
        </div>
      </div>
    </aside>
  )
}