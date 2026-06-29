export interface AuthUser {
  userId: string
  username: string
  roles: string[]
  department: string | null
  maxSecurityLevel: number
  sessionId?: string | null
}

export interface JwtPayload {
  sub: string
  username: string
  roles: string[]
  department?: string | null
  max_security_level?: number
  sid?: string
  iat?: number
  exp?: number
  iat_ms?: number
}
