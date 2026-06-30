import { type MouseEvent } from 'react'
import {
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
  User,
} from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useChatSessions } from '../contexts/ChatSessionContext'
import { hasAllowedRole, isAdminLikeRole } from '../lib/authz'

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
  const isSystemAdmin = !isAnonymous && hasAllowedRole(user?.roles, ['ADMIN'])

  const navItems = [
    { icon: MessageSquare, label: 'Chat AI', href: '/chat' },
    { icon: FileText, label: 'Tài liệu', href: '/docs' },
    ...(isAdmin
      ? [{ icon: LayoutDashboard, label: 'Dashboard', href: '/admin' }]
      : []),
    ...(!isAnonymous
      ? [{ icon: User, label: 'Hồ sơ tài khoản', href: '/account' }]
      : []),
    ...(isSystemAdmin
      ? [{ icon: Settings, label: 'Cài đặt', href: '/settings' }]
      : []),
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

  const handleDeleteSession = async (event: MouseEvent, id: string) => {
    event.stopPropagation()
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
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
      <div className="px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
            <GraduationCap size={18} />
          </div>
          <div>
            <p className="text-base font-bold leading-tight tracking-tight text-slate-800">
              EduMind
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Trợ lý ảo nội bộ
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={handleNewChat}
          data-testid="sidebar-new-chat"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-sm font-semibold text-blue-600 shadow-[0_2px_8px_rgba(37,99,235,0.05)] transition-all hover:bg-blue-50 hover:text-blue-700"
        >
          <Plus size={16} />
          Cuộc trò chuyện mới
        </button>
      </div>

      <div className="space-y-2 px-3">
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
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-50/50'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                size={16}
                className={isActive ? 'text-blue-600' : 'text-slate-400'}
              />
              {label}
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex-1 overflow-y-auto px-3">
        <div className="px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                  className={`w-full truncate rounded-lg px-3 py-2.5 pr-8 text-left text-xs font-medium transition-all ${
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
                    onClick={(event) => handleDeleteSession(event, item.id)}
                    data-testid={`sidebar-delete-session-${item.id}`}
                    className="absolute right-1 rounded p-1 text-slate-400 opacity-0 transition-all group-hover:opacity-100 hover:text-red-500"
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

      <div className="border-t border-slate-100 bg-slate-50/50 p-4">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-sm">
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-slate-800">
              {displayName}
            </p>
            <p className="truncate text-[11px] text-slate-400">{displayEmail}</p>
          </div>

          {isAnonymous ? (
            <button
              type="button"
              onClick={handleLogin}
              data-testid="sidebar-login"
              className="shrink-0 rounded-lg p-1.5 text-blue-500 transition-all hover:bg-blue-100 hover:text-blue-700"
              title="Đăng nhập"
            >
              <LogIn size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              data-testid="sidebar-logout"
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-600"
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
