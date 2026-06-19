export interface AuthUser {
  userId: string
  username: string
  roles: string[]
  department: string | null
  maxSecurityLevel: number
}

export interface JwtPayload {
  sub: string
  username: string
  roles: string[]
  department?: string | null
  max_security_level?: number
}
