import type { Request } from 'express'

const BEARER_TOKEN_PATTERN = /^Bearer\s+(.+)$/i
const JWT_COMPACT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const MAX_ACCESS_TOKEN_LENGTH = 4096

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null
  }
  return value?.trim() || null
}

export function readBearerToken(req: Pick<Request, 'headers'>): string | null {
  const header = firstHeaderValue(req.headers.authorization)
  if (!header) {
    return null
  }

  const match = header.match(BEARER_TOKEN_PATTERN)
  return match?.[1]?.trim() || null
}

export function isWellFormedJwtCompactToken(
  token: string | null | undefined,
): boolean {
  if (!token) {
    return false
  }

  const trimmed = token.trim()
  if (!trimmed || trimmed.length > MAX_ACCESS_TOKEN_LENGTH) {
    return false
  }

  return JWT_COMPACT_PATTERN.test(trimmed)
}

export function extractFormattedBearerJwt(
  req: Pick<Request, 'headers'>,
): string | null {
  const token = readBearerToken(req)
  return isWellFormedJwtCompactToken(token) ? token : null
}
