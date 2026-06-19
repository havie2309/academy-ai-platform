import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  isAdminLike,
  resolveAccessScope,
} from '../../../src/common/access-scope'
import type { AuthUser } from '../../../src/common/auth.types'
import { PostgresService } from '../../../src/common/postgres.service'

type UserAccessRow = {
  user_id: string
  username: string
  department: string | null
  max_security_level: number
  roles: string[]
  permissions: string[]
  scope_ma_hv: string | null
  scope_ma_gv: string | null
}

function mergeDeptScope(scopes: string[]): 'all' | 'own_department' {
  if (scopes.includes('all')) return 'all'
  return 'own_department'
}

@Injectable()
export class RbacService {
  constructor(private readonly pg: PostgresService) {}

  private async loadUserAccess(userId: string): Promise<UserAccessRow> {
    const { rows } = await this.pg.query<UserAccessRow>(
      `SELECT
         u.user_id,
         u.username,
         u.department,
         u.max_security_level,
         (
           SELECT h.ma_hv
           FROM hoc_vien h
           WHERE h.ma_hv = u.username
              OR lower(coalesce(h.email, '')) = lower(coalesce(u.email, ''))
              OR h.ho_ten = u.fullname
           LIMIT 1
         ) AS scope_ma_hv,
         (
           SELECT g.ma_gv
           FROM giang_vien g
           WHERE upper(g.ma_gv) = upper(u.username)
              OR lower(coalesce(g.email, '')) = lower(coalesce(u.email, ''))
              OR g.ho_ten = u.fullname
           LIMIT 1
         ) AS scope_ma_gv,
         COALESCE((
           SELECT ARRAY_AGG(DISTINCT r.code ORDER BY r.code)
           FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = u.user_id
             AND ur.is_active = true
             AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
         ), ARRAY[]::text[]) AS roles,
         COALESCE((
           SELECT ARRAY_AGG(DISTINCT code ORDER BY code)
           FROM (
             SELECT p.code
             FROM user_roles ur
             JOIN role_permissions rp ON rp.role_id = ur.role_id
             JOIN permissions p ON p.id = rp.permission_id
             WHERE ur.user_id = u.user_id
               AND ur.is_active = true
               AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
             UNION
             SELECT p.code
             FROM user_permissions up
             JOIN permissions p ON p.id = up.permission_id
             WHERE up.user_id = u.user_id
               AND up.is_active = true
               AND (up.expires_at IS NULL OR up.expires_at > NOW())
           ) permission_codes
         ), ARRAY[]::text[]) AS permissions
       FROM users u
       WHERE u.user_id = $1
         AND u.status = 'active'`,
      [userId],
    )
    if (!rows[0]) throw new NotFoundException('Khong tim thay nguoi dung RBAC.')
    return rows[0]
  }

  async getCurrentAccess(user: AuthUser) {
    const access = await this.loadUserAccess(user.userId)
    const derived = await resolveAccessScope({
      userId: access.user_id,
      username: access.username,
      roles: access.roles,
      department: access.department,
      maxSecurityLevel: access.max_security_level,
    })

    return {
      user_id: access.user_id,
      username: access.username,
      department: access.department,
      max_security_level: access.max_security_level,
      roles: access.roles,
      permissions: access.permissions,
      access_scope: derived,
    }
  }

  async getRoleMatrix() {
    const { rows } = await this.pg.query<{
      role_code: string
      role_name: string
      permission_code: string | null
    }>(
      `SELECT
         r.code AS role_code,
         r.name AS role_name,
         p.code AS permission_code
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       ORDER BY r.code, p.code`,
    )

    const matrix = new Map<
      string,
      { role_code: string; role_name: string; permissions: string[] }
    >()
    for (const row of rows) {
      const current = matrix.get(row.role_code) ?? {
        role_code: row.role_code,
        role_name: row.role_name,
        permissions: [],
      }
      if (
        row.permission_code &&
        !current.permissions.includes(row.permission_code)
      ) {
        current.permissions.push(row.permission_code)
      }
      matrix.set(row.role_code, current)
    }
    return Array.from(matrix.values())
  }

  async checkPermission(
    user: AuthUser,
    input: { permissionCode?: string; resource?: string; action?: string },
  ) {
    const access = await this.getCurrentAccess(user)
    const permissionCode =
      input.permissionCode?.trim() ||
      (input.resource && input.action
        ? `${input.resource.trim()}:${input.action.trim()}`
        : '')
    if (!permissionCode) {
      throw new BadRequestException(
        'permissionCode hoac resource/action la bat buoc.',
      )
    }

    const allowed = access.permissions.includes(permissionCode)

    return {
      allowed,
      permission_code: permissionCode,
      permissions: access.permissions,
      access_scope: access.access_scope,
      reason: allowed ? null : `missing permission ${permissionCode}`,
    }
  }

  private async loadCategoryPolicies(roleCodes: string[], categoryCode: string) {
    if (!roleCodes.length) return []
    const { rows } = await this.pg.query<{
      role_code: string
      allow_read: boolean
      allow_write: boolean
      dept_scope: string
    }>(
      `SELECT
         r.code AS role_code,
         p.allow_read,
         p.allow_write,
         p.dept_scope
       FROM role_category_policies p
       JOIN roles r ON r.id = p.role_id
       WHERE r.code = ANY($1::text[])
         AND p.category_code = $2`,
      [roleCodes, categoryCode],
    )
    return rows
  }

  async getRowFilter(
    user: AuthUser,
    input: { resource: string; action?: string; categoryCode?: string },
  ) {
    if (!input.resource?.trim()) {
      throw new BadRequestException('resource la bat buoc.')
    }

    const access = await this.getCurrentAccess(user)
    const scope = access.access_scope
    const resource = input.resource.trim()
    const action = (input.action ?? 'read').trim()
    const permissionCode = `${resource}:${action}`

    if (isAdminLike(access.roles)) {
      return {
        allowed: true,
        resource,
        action,
        access_scope: scope,
        predicates: [],
        permission_code: permissionCode,
        reason: null,
      }
    }

    if (
      ['hoc_vien', 'diem', 'ket_qua_hoc_ky', 'v_hoc_vien_gpa', 'v_diem_mon'].includes(
        resource,
      ) &&
      scope.scopeMaHv
    ) {
      return {
        allowed: true,
        resource,
        action,
        access_scope: scope,
        predicates: [{ field: 'ma_hv', op: '=', value: scope.scopeMaHv }],
        permission_code: permissionCode,
        reason: null,
      }
    }

    if (
      ['giang_vien', 'lop_hoc_phan', 'v_lop_hoc_phan_giang_day'].includes(
        resource,
      ) &&
      scope.scopeMaGv
    ) {
      return {
        allowed: true,
        resource,
        action,
        access_scope: scope,
        predicates: [{ field: 'ma_gv', op: '=', value: scope.scopeMaGv }],
        permission_code: permissionCode,
        reason: null,
      }
    }

    if (resource === 'documents') {
      const hasDocumentsPermission = access.permissions.includes(
        action === 'read' ? 'documents:read' : 'documents:write',
      )
      if (!hasDocumentsPermission) {
        return {
          allowed: false,
          resource,
          action,
          access_scope: scope,
          predicates: [],
          permission_code: permissionCode,
          reason: 'missing documents permission',
        }
      }

      if (!input.categoryCode?.trim()) {
        return {
          allowed: false,
          resource,
          action,
          access_scope: scope,
          predicates: [],
          permission_code: permissionCode,
          reason: 'categoryCode is required for document row filters',
        }
      }

      const policies = await this.loadCategoryPolicies(
        access.roles,
        input.categoryCode.trim(),
      )
      if (!policies.length) {
        return {
          allowed: false,
          resource,
          action,
          access_scope: scope,
          predicates: [],
          permission_code: permissionCode,
          reason: 'no category policy matched',
        }
      }

      const allowRead = policies.some((policy) => policy.allow_read)
      const allowWrite = policies.some((policy) => policy.allow_write)
      const deptScope = mergeDeptScope(
        policies.map((policy) => policy.dept_scope),
      )
      const allowed = action === 'read' ? allowRead : allowWrite

      return {
        allowed,
        resource,
        action,
        access_scope: scope,
        permission_code: permissionCode,
        reason: allowed ? null : 'category policy denies access',
        category_policy: {
          category_code: input.categoryCode.trim(),
          allow_read: allowRead,
          allow_write: allowWrite,
          dept_scope: deptScope,
        },
        predicates:
          deptScope === 'own_department' && scope.department
            ? [{ field: 'owner_unit_code', op: '=', value: scope.department }]
            : [],
      }
    }

    return {
      allowed: access.permissions.includes(permissionCode),
      resource,
      action,
      access_scope: scope,
      predicates: [],
      permission_code: permissionCode,
      reason: access.permissions.includes(permissionCode)
        ? null
        : `missing permission ${permissionCode}`,
    }
  }
}
