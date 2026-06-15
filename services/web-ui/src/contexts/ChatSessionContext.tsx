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
import { authApi } from '../api/auth'

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

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const refreshIdRef = useRef(0)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)
  const hasLoadedRef = useRef(false)

  const refreshSessions = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  const upsertSession = useCallback((session: ChatSession) => {
    hasLoadedRef.current = true
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === session.id)
      if (idx === -1) return sortSessions([session, ...prev])
      const next = [...prev]
      next[idx] = { ...next[idx], ...session }
      return sortSessions(next)
    })
  }, [])

  const createSession = useCallback(async (title?: string) => {
    const session = await chatApi.createSession(title)
    upsertSession(session)
    return session
  }, [upsertSession])

  const removeSession = useCallback(async (id: string) => {
    let previous: ChatSession[] = []
    setSessions((prev) => {
      previous = prev
      return prev.filter((s) => s.id !== id)
    })
    try {
      await chatApi.deleteSession(id)
    } catch (err) {
      setSessions(previous)
      throw err
    }
  }, [])

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
