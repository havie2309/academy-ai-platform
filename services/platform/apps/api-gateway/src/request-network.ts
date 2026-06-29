import type { Request } from 'express'
import { isIP } from 'node:net'

type TrustProxySetting = boolean | number | string | string[]

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.split(',')[0]?.trim() || null
  }
  return value?.split(',')[0]?.trim() || null
}

export function normalizeIpAddress(value: string | null | undefined): string | null {
  if (!value) return null

  let normalized = value.trim()
  if (!normalized) return null

  const zoneIndex = normalized.indexOf('%')
  if (zoneIndex >= 0) {
    normalized = normalized.slice(0, zoneIndex)
  }

  if (normalized.startsWith('::ffff:')) {
    const mappedIpv4 = normalized.slice('::ffff:'.length)
    if (isIP(mappedIpv4) === 4) {
      return mappedIpv4
    }
  }

  return isIP(normalized) ? normalized.toLowerCase() : null
}

export function resolveClientIp(req: Request): string | null {
  return (
    normalizeIpAddress(req.ip) ??
    normalizeIpAddress(req.socket?.remoteAddress ?? null)
  )
}

export function resolveClientCountry(
  req: Request,
  headerName: string,
): string | null {
  const raw = firstHeaderValue(req.headers[headerName.toLowerCase()])
  if (!raw) return null

  const country = raw.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(country) ? country : null
}

export function normalizeRequestPath(pathname: string): string {
  const clean = pathname.split('?')[0] ?? pathname
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1)
  }
  return clean
}

export function parseCsvConfig(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function parseTrustProxySetting(
  value: string | undefined,
): TrustProxySetting {
  const normalized = value?.trim()
  if (!normalized) return false

  const lowered = normalized.toLowerCase()
  if (lowered === 'true') return true
  if (lowered === 'false') return false

  const hops = Number(normalized)
  if (Number.isInteger(hops) && hops >= 0) {
    return hops
  }

  const items = parseCsvConfig(normalized)
  return items.length > 1 ? items : normalized
}
