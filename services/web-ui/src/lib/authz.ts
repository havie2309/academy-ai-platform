const ROLE_ALIASES: Record<string, string> = {
  ADMIN: 'ADMIN',
  BGD: 'BGD',
  P2: 'P2',
  P7: 'P7',
  HOCVIEN: 'HOC_VIEN',
  HOC_VIEN: 'HOC_VIEN',
  SINHVIEN: 'HOC_VIEN',
  SINH_VIEN: 'HOC_VIEN',
  GIANGVIEN: 'GIANG_VIEN',
  GIANG_VIEN: 'GIANG_VIEN',
  GV: 'GIANG_VIEN',
}

export const ADMIN_ROLE_CODES = ['ADMIN', 'BGD', 'P2', 'P7']

function foldRole(role: string): string {
  return role
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
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

export function hasAllowedRole(
  roles: string[] | null | undefined,
  allowedRoles: string[],
): boolean {
  const allowed = new Set(normalizeRoles(allowedRoles))
  return normalizeRoles(roles).some((role) => allowed.has(role))
}

export function isAdminLikeRole(
  roles: string[] | null | undefined,
): boolean {
  return hasAllowedRole(roles, ADMIN_ROLE_CODES)
}

export function formatRoleLabel(role: string): string {
  const normalized = normalizeRoles([role])[0] ?? role
  switch (normalized) {
    case 'ADMIN':
      return 'Admin'
    case 'BGD':
      return 'BGD'
    case 'P2':
      return 'P2'
    case 'P7':
      return 'P7'
    case 'HOC_VIEN':
      return 'Học viên'
    case 'GIANG_VIEN':
      return 'Giảng viên'
    default:
      return role
  }
}
