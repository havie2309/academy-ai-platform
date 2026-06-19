import type { AuthUser } from './auth.types'
import { getSharedPostgresPool } from './postgres.service'

const ADMIN_LIKE_ROLES = new Set(['ADMIN', 'BGD', 'P2'])
const ROLE_ALIASES: Record<string, string> = {
  HOCVIEN: 'HOC_VIEN',
  HOC_VIEN: 'HOC_VIEN',
  SINHVIEN: 'HOC_VIEN',
  SINH_VIEN: 'HOC_VIEN',
  GIANGVIEN: 'GIANG_VIEN',
  GIANG_VIEN: 'GIANG_VIEN',
  GV: 'GIANG_VIEN',
}

function foldRole(role: string): string {
  return role
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

export interface AccessScope {
  userId: string
  username: string
  roles: string[]
  normalizedRoles: string[]
  department: string | null
  maxSecurityLevel: number
  scopeMaHv: string | null
  scopeMaGv: string | null
}

type ScopeIdentifierRow = {
  bound_ma_hv: string | null
  bound_ma_gv: string | null
  ma_hv: string | null
  ma_gv: string | null
}

let scopeBindingInit: Promise<void> | null = null

async function ensureScopeBindingSupport(): Promise<void> {
  if (!scopeBindingInit) {
    scopeBindingInit = (async () => {
      const pool = getSharedPostgresPool()
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_scope_bindings (
          user_id VARCHAR(20) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
          profile_type VARCHAR(20) NOT NULL CHECK (profile_type IN ('hoc_vien', 'giang_vien')),
          profile_code VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)
      await pool.query(`
        INSERT INTO user_scope_bindings (user_id, profile_type, profile_code)
        SELECT u.user_id, 'hoc_vien', hv.ma_hv
        FROM users u
        CROSS JOIN LATERAL (
          SELECT ma_hv
          FROM hoc_vien
          WHERE active = true
          ORDER BY ma_hv
          LIMIT 1
        ) hv
        WHERE u.username = 'hv001'
        ON CONFLICT (user_id) DO NOTHING
      `)
      await pool.query(`
        INSERT INTO user_scope_bindings (user_id, profile_type, profile_code)
        SELECT u.user_id, 'giang_vien', gv.ma_gv
        FROM users u
        CROSS JOIN LATERAL (
          SELECT ma_gv
          FROM giang_vien
          WHERE active = true
          ORDER BY ma_gv
          LIMIT 1
        ) gv
        WHERE lower(u.username) = 'gv001'
        ON CONFLICT (user_id) DO NOTHING
      `)
    })().catch(() => {})
  }

  await scopeBindingInit
}

export function normalizeRoles(roles: string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const role of roles ?? []) {
    const folded = foldRole(String(role))
    const canonical = ROLE_ALIASES[folded] ?? folded
    if (!canonical || seen.has(canonical)) continue
    seen.add(canonical)
    normalized.push(canonical)
  }
  return normalized
}

export function isAdminLike(roles: string[] | null | undefined): boolean {
  return normalizeRoles(roles).some((role) => ADMIN_LIKE_ROLES.has(role))
}

export function deriveAccessScope(user: Partial<AuthUser>): AccessScope {
  const username = String(user.username ?? '').trim()
  const normalizedRoles = normalizeRoles(user.roles)
  const scopeMaHv =
    normalizedRoles.includes('HOC_VIEN') && /^\d{4,}$/.test(username)
      ? username
      : null
  const scopeMaGv =
    normalizedRoles.includes('GIANG_VIEN') && /^GV[\w-]*$/i.test(username)
      ? username.toUpperCase()
      : null

  return {
    userId: String(user.userId ?? '').trim(),
    username,
    roles: (user.roles ?? []).map(String),
    normalizedRoles,
    department: user.department ?? null,
    maxSecurityLevel: user.maxSecurityLevel ?? 1,
    scopeMaHv,
    scopeMaGv,
  }
}

export async function resolveAccessScope(
  user: Partial<AuthUser>,
): Promise<AccessScope> {
  const scope = deriveAccessScope(user)
  const needsStudentScope =
    scope.normalizedRoles.includes('HOC_VIEN') && !scope.scopeMaHv
  const needsLecturerScope =
    scope.normalizedRoles.includes('GIANG_VIEN') && !scope.scopeMaGv

  if ((!needsStudentScope && !needsLecturerScope) || !scope.userId) {
    return scope
  }

  try {
    await ensureScopeBindingSupport()
    const pool = getSharedPostgresPool()
    const { rows } = await pool.query<ScopeIdentifierRow>(
      `
      SELECT
        (
          SELECT b.profile_code
          FROM user_scope_bindings b
          WHERE b.user_id = u.user_id
            AND b.profile_type = 'hoc_vien'
          LIMIT 1
        ) AS bound_ma_hv,
        (
          SELECT b.profile_code
          FROM user_scope_bindings b
          WHERE b.user_id = u.user_id
            AND b.profile_type = 'giang_vien'
          LIMIT 1
        ) AS bound_ma_gv,
        (
          SELECT h.ma_hv
          FROM hoc_vien h
          WHERE h.ma_hv = u.username
             OR lower(coalesce(h.email, '')) = lower(coalesce(u.email, ''))
             OR h.ho_ten = u.fullname
          LIMIT 1
        ) AS ma_hv,
        (
          SELECT g.ma_gv
          FROM giang_vien g
          WHERE upper(g.ma_gv) = upper(u.username)
             OR lower(coalesce(g.email, '')) = lower(coalesce(u.email, ''))
             OR g.ho_ten = u.fullname
          LIMIT 1
        ) AS ma_gv
      FROM users u
      WHERE u.user_id = $1
      LIMIT 1
      `,
      [scope.userId],
    )

    const row = rows[0]
    if (!row) return scope

    return {
      ...scope,
      scopeMaHv: scope.scopeMaHv ?? row.bound_ma_hv ?? row.ma_hv ?? null,
      scopeMaGv: scope.scopeMaGv ?? row.bound_ma_gv ?? row.ma_gv ?? null,
    }
  } catch {
    return scope
  }
}
