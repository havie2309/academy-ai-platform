// services/platform/apps/admin-config/src/admin-config.service.ts

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common'
import { isAdminLike } from '../../../src/common/access-scope'
import { writeAuditLog } from '../../../src/common/audit-log'
import type { AuthUser } from '../../../src/common/auth.types'
import { PostgresService } from '../../../src/common/postgres.service'

export interface RagPolicyConfig {
  enabled: boolean
  guardrailRules: GuardrailRule[]
  safeRefusalMessage: string
}

export interface GuardrailRule {
  id: string
  label: string
  enabled: boolean
  phrases: string[]
  matchMode?: GuardrailMatchMode
  fuzzyThreshold?: number
  semanticThreshold?: number
  synonyms?: string[]
}

export type GuardrailMatchMode = 'substring' | 'exact' | 'fuzzy' | 'semantic'

export interface GuardrailRulePatch {
  id?: string
  label?: string
  enabled?: boolean
  phrases?: string[]
  matchMode?: GuardrailMatchMode
  fuzzyThreshold?: number
  semanticThreshold?: number
  synonyms?: string[]
}

export interface StoredAdminConfig<T> {
  config_key: string
  version: number
  updated_at: string
  value: T
}

const RAG_POLICY_KEY = 'rag_policy'
const DEFAULT_SAFE_REFUSAL =
  'Xin lỗi, tôi không thể trả lời câu hỏi này theo chính sách an toàn hiện tại.'

// Legacy fallback constants (used when upgrading from old keyword-only policy)
const LEGACY_BLACKLIST_RULE_ID = 'legacy-keyword-blacklist'
const LEGACY_BLACKLIST_RULE_LABEL = 'Từ khóa bị chặn (legacy)'

// Absolute no‑go terms (keyword-based, high precision)
const ABSOLUTE_KEYWORD_PHRASES = [
  'truy cập trái phép',
  'mật khẩu hệ thống',
  'bypass quyền',
  'vượt quyền truy cập',
]

// Refined semantic phrases (longer, intent-specific)
const SEMANTIC_PHRASES = [
  'hướng dẫn từng bước gian lận trong phòng thi',
  'thủ thuật mang tài liệu cấm vào phòng thi',
  'yêu cầu cung cấp đáp án đề thi hiện tại',
  'cách thức vượt tường lửa hệ thống',
  'chiến lược lấy cắp dữ liệu nội bộ',
]

const SEMANTIC_SYNONYMS = [
  'mẹo gian lận trong kỳ thi',
  'cách giấu tài liệu trong phòng thi',
  'xin đáp án đề thi',
  'hack tài khoản',
  'đánh cắp thông tin',
]

function normalizeUnique(values: string[] | undefined): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const value of values ?? []) {
    const item = String(value).trim()
    if (!item) continue
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(item)
  }
  return normalized
}

function defaultGuardrailRules(): GuardrailRule[] {
  return [
    // Semantic rule – the primary guardrail for exam/cheating queries
    {
      id: 'default-semantic-blocklist',
      label: 'Chặn theo ngữ nghĩa (demo)',
      enabled: true,
      phrases: SEMANTIC_PHRASES,
      matchMode: 'semantic',
      semanticThreshold: 0.88,
      synonyms: SEMANTIC_SYNONYMS,
    },
    // Fallback keyword rule for absolute terms – avoids false positives
    {
      id: 'default-keyword-credentials',
      label: 'Từ khóa tuyệt đối',
      enabled: true,
      phrases: ABSOLUTE_KEYWORD_PHRASES,
      matchMode: 'substring',
    },
  ]
}

const VALID_MATCH_MODES = new Set<GuardrailMatchMode>([
  'substring',
  'exact',
  'fuzzy',
  'semantic',
])

function readMatchMode(raw: unknown): GuardrailMatchMode {
  const mode = String(raw ?? 'substring').trim().toLowerCase()
  return VALID_MATCH_MODES.has(mode as GuardrailMatchMode)
    ? (mode as GuardrailMatchMode)
    : 'substring'
}

function readThreshold(raw: unknown, fallback: number): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(value, 0), 1)
}

function normalizeRules(
  rules: GuardrailRulePatch[] | undefined,
): GuardrailRule[] {
  const normalized: GuardrailRule[] = []
  const seen = new Set<string>()
  for (const rule of rules ?? []) {
    const phrases = normalizeUnique(rule.phrases)
    const id = String(rule.id ?? '').trim() || `rule-${normalized.length + 1}`
    if (!phrases.length || seen.has(id)) continue
    seen.add(id)
    normalized.push({
      id,
      label:
        String(rule.label ?? '').trim() ||
        `Rule ${normalized.length + 1}`,
      enabled: rule.enabled !== false,
      phrases,
      matchMode: readMatchMode(rule.matchMode),
      fuzzyThreshold: readThreshold(rule.fuzzyThreshold, 0.85),
      semanticThreshold: readThreshold(rule.semanticThreshold, 0.78),
      synonyms: normalizeUnique(rule.synonyms),
    })
  }
  return normalized.length ? normalized : defaultGuardrailRules()
}

function migrateLegacyPolicy(
  value: Partial<RagPolicyConfig> & { blacklistKeywords?: string[] },
): RagPolicyConfig {
  return {
    enabled: value.enabled !== false,
    guardrailRules:
      value.guardrailRules && value.guardrailRules.length > 0
        ? normalizeRules(value.guardrailRules)
        : normalizeRules([
            {
              id: 'default-semantic-blocklist',
              label: 'Chặn theo ngữ nghĩa (demo)',
              enabled: true,
              phrases: SEMANTIC_PHRASES,
              matchMode: 'semantic',
              semanticThreshold: 0.88,
              synonyms: SEMANTIC_SYNONYMS,
            },
            {
              id: 'default-keyword-credentials',
              label: 'Từ khóa tuyệt đối',
              enabled: true,
              phrases: ABSOLUTE_KEYWORD_PHRASES,
              matchMode: 'substring',
            },
          ]),
    safeRefusalMessage:
      String(value.safeRefusalMessage ?? '').trim() || DEFAULT_SAFE_REFUSAL,
  }
}

@Injectable()
export class AdminConfigService implements OnModuleInit {
  constructor(private readonly pg: PostgresService) {}

  async onModuleInit() {
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS admin_configs (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS prompt_change_log (
        change_id BIGSERIAL PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL,
        old_value JSONB,
        new_value JSONB NOT NULL,
        version INTEGER NOT NULL,
        changed_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
        change_reason TEXT,
        changed_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await this.ensureDefaultRagPolicy()
  }

  private defaultRagPolicy(): RagPolicyConfig {
    return {
      enabled: true,
      guardrailRules: defaultGuardrailRules(),
      safeRefusalMessage: DEFAULT_SAFE_REFUSAL,
    }
  }

  private assertAdmin(user: AuthUser) {
    if (!isAdminLike(user.roles)) {
      throw new ForbiddenException(
        'Tai khoan hien tai khong co quyen quan ly chinh sach AI.',
      )
    }
  }

  private sanitizePatch(
    patch: Omit<Partial<RagPolicyConfig>, 'guardrailRules'> & {
      guardrailRules?: GuardrailRulePatch[]
      blacklistKeywords?: string[]
    },
    current: RagPolicyConfig,
  ): RagPolicyConfig {
    const safeRefusalMessage =
      typeof patch.safeRefusalMessage === 'string'
        ? patch.safeRefusalMessage.trim()
        : current.safeRefusalMessage
    if (!safeRefusalMessage) {
      throw new BadRequestException('safeRefusalMessage khong duoc de trong.')
    }

    // If guardrailRules is provided, use them.
    // Otherwise, if blacklistKeywords is provided (legacy), convert to a keyword rule.
    let guardrailRules: GuardrailRule[]
    if (patch.guardrailRules != null) {
      guardrailRules = normalizeRules(patch.guardrailRules)
    } else if (patch.blacklistKeywords != null) {
      // Legacy blacklist: create a single keyword rule with the provided phrases.
      const legacyRule: GuardrailRulePatch = {
        id: LEGACY_BLACKLIST_RULE_ID,
        label: LEGACY_BLACKLIST_RULE_LABEL,
        enabled: true,
        phrases: patch.blacklistKeywords,
        matchMode: 'substring',
      }
      guardrailRules = normalizeRules([legacyRule])
    } else {
      // Keep current rules.
      guardrailRules = current.guardrailRules
    }

    return {
      enabled:
        typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
      guardrailRules,
      safeRefusalMessage,
    }
  }

  private toDto(row: {
    config_key: string
    version: number
    updated_at: Date
    config_value: RagPolicyConfig
  }): StoredAdminConfig<RagPolicyConfig> {
    return {
      config_key: row.config_key,
      version: row.version,
      updated_at: row.updated_at.toISOString(),
      value: migrateLegacyPolicy(row.config_value),
    }
  }

  private async ensureDefaultRagPolicy() {
    const defaultPolicy = this.defaultRagPolicy()
    const inserted = await this.pg.query<{ config_key: string }>(
      `INSERT INTO admin_configs (config_key, config_value, version)
       VALUES ($1, $2::jsonb, 1)
       ON CONFLICT (config_key) DO NOTHING
       RETURNING config_key`,
      [RAG_POLICY_KEY, JSON.stringify(defaultPolicy)],
    )
    if (!inserted.rows[0]) return

    await this.pg.query(
      `INSERT INTO prompt_change_log (config_key, old_value, new_value, version, change_reason)
       VALUES ($1, NULL, $2::jsonb, 1, $3)`,
      [
        RAG_POLICY_KEY,
        JSON.stringify(defaultPolicy),
        'bootstrap default rag policy',
      ],
    )
  }

  async getRagPolicy(): Promise<StoredAdminConfig<RagPolicyConfig>> {
    await this.ensureDefaultRagPolicy()
    const { rows } = await this.pg.query<{
      config_key: string
      version: number
      updated_at: Date
      config_value: RagPolicyConfig
    }>(
      `SELECT config_key, version, updated_at, config_value
       FROM admin_configs
       WHERE config_key = $1`,
      [RAG_POLICY_KEY],
    )
    return this.toDto(rows[0])
  }

  async updateRagPolicy(
    user: AuthUser,
    patch: Omit<Partial<RagPolicyConfig>, 'guardrailRules'> & {
      guardrailRules?: GuardrailRulePatch[]
      blacklistKeywords?: string[]
      reason?: string
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<StoredAdminConfig<RagPolicyConfig>> {
    this.assertAdmin(user)
    const reason = String(patch.reason ?? '').trim() || 'manual policy update'
    await this.ensureDefaultRagPolicy()
    const client = await this.pg.client.connect()
    try {
      await client.query('BEGIN')
      const currentResult = await client.query<{
        config_key: string
        version: number
        updated_at: Date
        config_value: RagPolicyConfig
      }>(
        `SELECT config_key, version, updated_at, config_value
         FROM admin_configs
         WHERE config_key = $1
         FOR UPDATE`,
        [RAG_POLICY_KEY],
      )
      const currentRow = currentResult.rows[0]
      if (!currentRow) {
        throw new BadRequestException('Khong tai duoc chinh sach AI hien tai.')
      }

      const current = this.toDto(currentRow)
      const next = this.sanitizePatch(patch, current.value)
      const version = current.version + 1

      const updatedResult = await client.query<{
        config_key: string
        version: number
        updated_at: Date
        config_value: RagPolicyConfig
      }>(
        `UPDATE admin_configs
         SET config_value = $2::jsonb,
             version = $3,
             updated_by = $4,
             updated_at = NOW()
         WHERE config_key = $1
         RETURNING config_key, version, updated_at, config_value`,
        [RAG_POLICY_KEY, JSON.stringify(next), version, user.userId],
      )
      await client.query(
        `INSERT INTO prompt_change_log (
           config_key, old_value, new_value, version, changed_by, change_reason
         ) VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6)`,
        [
          RAG_POLICY_KEY,
          JSON.stringify(current.value),
          JSON.stringify(next),
          version,
          user.userId,
          reason,
        ],
      )
      await client.query('COMMIT')

      await writeAuditLog({
        userId: user.userId,
        action: 'update',
        resourceType: 'admin_config',
        resourceId: RAG_POLICY_KEY,
        oldValue: current.value,
        newValue: next,
        ipAddress,
        userAgent,
        status: 'success',
        reason,
      })
      return this.toDto(updatedResult.rows[0])
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  canManagePolicy(user: AuthUser): boolean {
    return isAdminLike(user.roles)
  }
}
