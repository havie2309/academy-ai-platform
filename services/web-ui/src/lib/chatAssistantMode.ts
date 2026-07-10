import { useEffect, useState } from 'react'

export type ChatAssistantMode = 'centralized' | 'personal'

const STORAGE_KEY = 'chat_assistant_mode'
const CHANGE_EVENT = 'chat-assistant-mode-change'

export function getStoredChatAssistantMode(): ChatAssistantMode {
  if (typeof window === 'undefined') return 'centralized'

  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw === 'personal' ? 'personal' : 'centralized'
}

export function setStoredChatAssistantMode(mode: ChatAssistantMode) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(STORAGE_KEY, mode)
  window.dispatchEvent(new CustomEvent<ChatAssistantMode>(CHANGE_EVENT, { detail: mode }))
}

export function useChatAssistantMode() {
  const [mode, setMode] = useState<ChatAssistantMode>(() => getStoredChatAssistantMode())

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncFromStorage = () => {
      setMode(getStoredChatAssistantMode())
    }

    const handleCustomEvent = (event: Event) => {
      const nextMode = (event as CustomEvent<ChatAssistantMode>).detail
      setMode(nextMode === 'personal' ? 'personal' : 'centralized')
    }

    window.addEventListener('storage', syncFromStorage)
    window.addEventListener(CHANGE_EVENT, handleCustomEvent as EventListener)

    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(CHANGE_EVENT, handleCustomEvent as EventListener)
    }
  }, [])

  return {
    mode,
    setMode: (nextMode: ChatAssistantMode) => {
      setMode(nextMode)
      setStoredChatAssistantMode(nextMode)
    },
  }
}
