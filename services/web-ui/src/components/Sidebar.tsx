import { type MouseEvent } from 'react'
import {
  MessageSquare,
  FileText,
  LayoutDashboard,
  Settings,
  Plus,
  GraduationCap,
  LogOut,
  LogIn,
  Trash2,
} from 'lucide-react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useChatSessions } from '../contexts/ChatSessionContext'
import { isAdminLikeRole } from '../lib/authz'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sessionId: activeSessionId } = useParams()
  const { sessions, loading, removeSession } = useChatSessions()

  const user = authApi.getUser()
  const isAuthenticated = authApi.isAuthenticated()
  const isAnonymous = !isAuthenticated || user?.id === 'anonymous'

  const displayName = isAnonymous ? 'Khách' : (user?.full_name ?? 'Khách')
  const displayEmail = isAnonymous
    ? 'guest@academy.edu'
    : (user?.username ? `${user.username}@academy.edu` : '')
  const avatarLetter = displayName.charAt(0).toUpperCase()
  const isAdmin = !isAnonymous && isAdminLikeRole(user?.roles)

  // Navigation items based on auth state
  const navItems = [
    { icon: MessageSquare, label: 'Chat AI', href: '/chat', public: true },
    { icon: FileText, label: 'Tài liệu', href: '/docs', public: true },
    ...(isAdmin ? [{ icon: LayoutDashboard, label: 'Dashboard', href: '/admin', public: false }] : []),
    ...(!isAnonymous ? [{ icon: Settings, label: 'Cài đặt', href: '/settings', public: false }] : []),
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

  const handleLogin = () => {
    navigate('/login')
  }

  const handleLogout = async () => {
    await authApi.logout()
    navigate('/login')
  }

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
            <p className="text-slate-400 text-[11px] font-medium tracking-wide uppercase">
              Trợ lý ảo nội bộ
            </p>
          </div>
        </div>
      </div>

      {/* New Chat – visible even for anonymous, but will show login prompt if not authenticated */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={handleNewChat}
          data-testid="sidebar-new-chat"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 text-blue-600 hover:text-blue-700 text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(37,99,235,0.05)]"
        >
          <Plus size={16} />
          Cuộc trò chuyện mới
        </button>
      </div>

      {/* Navigation */}
      <div className="px-3 space-y-2">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive =
            location.pathname === href ||
            (href === '/chat' && location.pathname.startsWith('/chat'))
          return (
            <button
              key={href}
              type="button"
              onClick={() => navigate(href)}
              data-testid={`sidebar-link-${href.replace('/', '') || 'root'}`}
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

      {/* Chat History – still visible for anonymous (public sessions) */}
      <div className="flex-1 overflow-y-auto px-3 mt-6">
        <div className="px-3 py-2">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            Hội thoại gần đây
          </p>
        </div>
        <div className="space-y-1">
          {loading && <p className="px-3 py-2 text-xs text-slate-400">Đang tải…</p>}
          {!loading && sessions.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400">
              {isAnonymous ? 'Đăng nhập để xem lịch sử' : 'Chưa có hội thoại'}
            </p>
          )}
          {sessions.map((item) => {
            const isActive = activeSessionId === item.id
            return (
              <div key={item.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => navigate(`/chat/${item.id}`)}
                  data-testid={`sidebar-session-${item.id}`}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs truncate transition-all font-medium pr-8 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                  title={item.title}
                >
                  {item.title}
                </button>
                {!isAnonymous && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(e, item.id)}
                    data-testid={`sidebar-delete-session-${item.id}`}
                    className="absolute right-1 p-1 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                    title="Xóa hội thoại"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* User Profile / Auth */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 px-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-slate-800 text-sm font-semibold leading-tight truncate">
              {displayName}
            </p>
            <p className="text-slate-400 text-[11px] truncate">{displayEmail}</p>
          </div>

          {isAnonymous ? (
            <button
              type="button"
              onClick={handleLogin}
              data-testid="sidebar-login"
              className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-all shrink-0"
              title="Đăng nhập"
            >
              <LogIn size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              data-testid="sidebar-logout"
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all shrink-0"
              title="Đăng xuất"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}