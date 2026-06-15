import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { chatApi, type ChatSession } from '../api/chat'
import { authApi } from '../api/auth'

interface ChatSessionContextValue {
  sessions: ChatSession[]
  loading: boolean
  refreshSessions: () => Promise<void>
  createSession: (title?: string) => Promise<ChatSession>
  removeSession: (id: string) => Promise<void>
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null)

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)

  const refreshSessions = useCallback(async () => {
    if (!authApi.isAuthenticated()) {
      setSessions([])
      setLoading(false)
      return
    }
    try {
      const list = await chatApi.listSessions()
      setSessions(list)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  const createSession = useCallback(
    async (title?: string) => {
      const session = await chatApi.createSession(title)
      await refreshSessions()
      return session
    },
    [refreshSessions],
  )

  const removeSession = useCallback(
    async (id: string) => {
      await chatApi.deleteSession(id)
      await refreshSessions()
    },
    [refreshSessions],
  )

  return (
    <ChatSessionContext.Provider
      value={{ sessions, loading, refreshSessions, createSession, removeSession }}
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
