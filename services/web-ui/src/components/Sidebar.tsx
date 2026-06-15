import { type MouseEvent } from 'react'
import { MessageSquare, FileText, LayoutDashboard, Settings, Plus, GraduationCap, LogOut, Trash2 } from 'lucide-react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useChatSessions } from '../contexts/ChatSessionContext'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sessionId: activeSessionId } = useParams()
  const { sessions, loading, removeSession } = useChatSessions()

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

  const handleNewChat = () => {
    if (activeSessionId) {
      navigate('/chat')
      return
    }
    if (location.pathname !== '/chat') {
      navigate('/chat')
    }
  }

  const handleDeleteSession = async (e: MouseEvent, id: string) => {
    e.stopPropagation()
    await removeSession(id)
    if (activeSessionId === id) navigate('/chat')
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col h-full bg-white border-r border-slate-200/80 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
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

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 text-blue-600 hover:text-blue-700 text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(37,99,235,0.05)]"
        >
          <Plus size={16} />
          Cuộc trò chuyện mới
        </button>
      </div>

      <div className="px-3 space-y-2">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = location.pathname === href || (href === '/chat' && location.pathname.startsWith('/chat'))
          return (
            <button
              key={href}
              type="button"
              onClick={() => navigate(href)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
              {label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-3 mt-6">
        <div className="px-3 py-2">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Hội thoại gần đây</p>
        </div>
        <div className="space-y-1">
          {loading && (
            <p className="px-3 py-2 text-xs text-slate-400">Đang tải…</p>
          )}
          {!loading && sessions.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">Chưa có hội thoại</p>
          )}
          {sessions.map((item) => {
            const isActive = activeSessionId === item.id
            return (
              <div key={item.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => navigate(`/chat/${item.id}`)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs truncate transition-all font-medium pr-8 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                  title={item.title}
                >
                  {item.title}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSession(e, item.id)}
                  className="absolute right-1 p-1 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                  title="Xóa hội thoại"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

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
            type="button"
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
