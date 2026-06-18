import { authApi } from './auth'
import { apiUrl } from './base'

let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = authApi.refresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

/** Fetch with Bearer access token; auto-refresh once on 401. */
export async function fetchWithAuth(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const buildHeaders = (token: string | null) => {
    const headers: Record<string, string> = {
      ...((init.headers as Record<string, string>) ?? {}),
    }
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  const doFetch = (token: string | null) =>
    fetch(apiUrl(path), {
      ...init,
      credentials: 'include',
      headers: buildHeaders(token),
    })

  let res = await doFetch(authApi.getToken())
  if (res.status !== 401) return res

  const newToken = await refreshAccessToken()
  if (!newToken) {
    authApi.clearLocalSession()
    return res
  }

  return doFetch(newToken)
}
