import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { chatApi, type ChatSession } from '../api/chat'
import { authApi, ANONYMOUS_USER } from '../api/auth'

function sortSessions(list: ChatSession[]): ChatSession[] {
  return [...list].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}

interface ChatSessionContextValue {
  sessions: ChatSession[]
  loading: boolean
  refreshSessions: () => Promise<void>
  createSession: (title?: string) => Promise<ChatSession>
  upsertSession: (session: ChatSession) => void
  removeSession: (id: string) => Promise<void>
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null)
const ANON_SESSIONS_KEY = 'anon_chat_sessions'

function loadAnonSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(ANON_SESSIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveAnonSessions(sessions: ChatSession[]) {
  localStorage.setItem(ANON_SESSIONS_KEY, JSON.stringify(sessions))
}

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const refreshIdRef = useRef(0)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)
  const hasLoadedRef = useRef(false)

  const isAnonymous = authApi.isAnonymous()

  const refreshSessions = useCallback(async () => {
    // If anonymous, load from localStorage
    if (isAnonymous) {
      const anonSessions = loadAnonSessions()
      setSessions(sortSessions(anonSessions))
      setLoading(false)
      hasLoadedRef.current = true
      return
    }

    if (!authApi.isAuthenticated()) {
      setSessions([])
      setLoading(false)
      hasLoadedRef.current = false
      return
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current
    }

    const requestId = ++refreshIdRef.current
    const run = (async () => {
      try {
        const list = await chatApi.listSessions()
        if (requestId !== refreshIdRef.current) return
        setSessions(sortSessions(list))
        hasLoadedRef.current = true
      } catch (err) {
        if (requestId !== refreshIdRef.current) return
        if (!hasLoadedRef.current) {
          console.warn('Failed to load chat sessions', err)
        }
      } finally {
        if (requestId === refreshIdRef.current) setLoading(false)
        refreshInFlightRef.current = null
      }
    })()

    refreshInFlightRef.current = run
    return run
  }, [isAnonymous])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  const upsertSession = useCallback((session: ChatSession) => {
    hasLoadedRef.current = true
    
    // If anonymous, save to localStorage
    if (isAnonymous) {
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === session.id)
        const next = idx === -1 
          ? sortSessions([session, ...prev])
          : sortSessions(prev.map((s) => s.id === session.id ? { ...s, ...session } : s))
        saveAnonSessions(next)
        return next
      })
      return
    }

    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id)
      if (idx === -1) return sortSessions([session, ...prev])
      const next = [...prev]
      next[idx] = { ...next[idx], ...session }
      return sortSessions(next)
    })
  }, [isAnonymous])

  const createSession = useCallback(async (title?: string) => {
    // If anonymous, create local session without API call
    if (isAnonymous) {
      const session: ChatSession = {
        id: `anon-${Date.now()}`,
        title: title || 'Hội thoại khách',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      upsertSession(session)
      return session
    }

    const session = await chatApi.createSession(title)
    upsertSession(session)
    return session
  }, [isAnonymous, upsertSession])

  const removeSession = useCallback(async (id: string) => {
    let previous: ChatSession[] = []
    setSessions((prev) => {
      previous = prev
      return prev.filter((s) => s.id !== id)
    })

    // If anonymous, just remove from localStorage
    if (isAnonymous) {
      const updated = sessions.filter((s) => s.id !== id)
      saveAnonSessions(updated)
      return
    }

    try {
      await chatApi.deleteSession(id)
    } catch (err) {
      setSessions(previous)
      throw err
    }
  }, [isAnonymous, sessions])

  return (
    <ChatSessionContext.Provider
      value={{
        sessions,
        loading,
        refreshSessions,
        createSession,
        upsertSession,
        removeSession,
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  )
}

export function useChatSessions() {
  const ctx = useContext(ChatSessionContext)
  if (!ctx) throw new Error('useChatSessions must be used within ChatSessionProvider')
  return ctx
}