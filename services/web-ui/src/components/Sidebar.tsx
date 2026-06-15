import { MessageSquare, FileText, LayoutDashboard, Settings, Plus, GraduationCap, LogOut } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '../api/auth'

const history = ['Hỏi về lịch thi HK2', 'Điểm trung bình lớp K65', 'Tài liệu môn Học máy']

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const user = authApi.getUser()
  const displayName = user?.full_name ?? 'Khách'
  const displayEmail = user?.username ? `${user.username}@academy.edu` : ''
  const avatarLetter = displayName.charAt(0).toUpperCase()
  const isAdmin = user?.roles.some(r => ['Admin', 'BGD', 'P2', 'P7'].includes(r)) ?? false

  const navItems = [
    { icon: MessageSquare, label: 'Chat AI', href: '/chat' },
    { icon: FileText, label: 'Tài liệu', href: '/docs' },
    ...(isAdmin ? [{ icon: LayoutDashboard, label: 'Dashboard', href: '/admin' }] : []),
    { icon: Settings, label: 'Cài đặt', href: '/settings' },
  ]

  return (
    <aside className="w-64 shrink-0 flex flex-col h-full bg-white border-r border-slate-200/80 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20 text-white">
            <GraduationCap size={18} />
          </div>
          <div>
            <p className="text-slate-800 font-bold text-base leading-tight tracking-tight">EduMind</p>
            <p className="text-slate-400 text-[11px] font-medium tracking-wide uppercase">Trợ lý ảo nội bộ</p>
          </div>
        </div>
      </div>

      {/* Action: New Chat */}
      <div className="px-4 pb-4">
        <button
          onClick={() => navigate('/chat')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 text-blue-600 hover:text-blue-700 text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(37,99,235,0.05)]"
        >
          <Plus size={16} />
          Cuộc trò chuyện mới
        </button>
      </div>

      {/* Main Nav */}
      <div className="px-3 space-y-2">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = location.pathname === href
          return (
            <button
              key={href}
              onClick={() => navigate(href)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'} />
              {label}
            </button>
          )
        })}
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto px-3 mt-6">
        <div className="px-3 py-2">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Hội thoại gần đây</p>
        </div>
        <div className="space-y-1.5">
          {history.map((item) => (
            <button
              key={item}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 text-xs text-slate-500 hover:text-slate-800 truncate transition-all block font-medium"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 px-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-slate-800 text-sm font-semibold leading-tight truncate">{displayName}</p>
            <p className="text-slate-400 text-[11px] truncate">{displayEmail}</p>
          </div>
          <button
            onClick={() => { authApi.logout(); navigate('/login') }}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all shrink-0"
            title="Đăng xuất"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}