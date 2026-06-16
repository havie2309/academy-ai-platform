const configuredApiBase = import.meta.env.VITE_API_URL?.trim()

export const API_BASE = configuredApiBase
  ? configuredApiBase
  : import.meta.env.DEV
    ? ''
    : 'http://localhost:3000'

export function apiUrl(path: string) {
  return `${API_BASE}${path}`
}
