import type { GuardrailMatchMode, GuardrailRule } from '../api/admin'
import { buildAutoSynonyms } from './guardrailSynonyms'

export const DEFAULT_RULE_ID = 'default-keyword-blocklist'
export const DEFAULT_RULE_LABEL = 'Danh sách từ khóa bị chặn'

export const MATCH_MODE_OPTIONS: Array<{
  value: GuardrailMatchMode
  label: string
  description: string
}> = [
  {
    value: 'substring',
    label: 'Khớp chuỗi con',
    description: 'Chặn khi câu hỏi chứa cụm từ; hệ thống tự sinh synonym ẩn khi lưu.',
  },
  {
    value: 'fuzzy',
    label: 'Khớp mờ (typo)',
    description: 'Bắt lỗi chính tả hoặc biến thể gần giống cụm từ.',
  },
  {
    value: 'semantic',
    label: 'Khớp ngữ nghĩa',
    description: 'Chỉ chạy trên server khi bật GUARDRAIL_SEMANTIC_ENABLED.',
  },
]

export function parseLineList(text: string): string[] {
  const seen = new Set<string>()
  const values: string[] = []
  for (const item of text.split(/[\r\n,]+/)) {
    const value = item.trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    values.push(value)
  }
  return values
}

export function linesFromList(values: string[] | undefined): string {
  return (values ?? []).join('\n')
}

export function normalizeGuardrailRule(rule: GuardrailRule): GuardrailRule {
  const phrases = parseLineList(linesFromList(rule.phrases))
  return {
    id: rule.id.trim() || DEFAULT_RULE_ID,
    label: rule.label.trim() || DEFAULT_RULE_LABEL,
    enabled: rule.enabled !== false,
    phrases,
    matchMode: rule.matchMode ?? 'substring',
    fuzzyThreshold:
      typeof rule.fuzzyThreshold === 'number' ? rule.fuzzyThreshold : 0.85,
    semanticThreshold:
      typeof rule.semanticThreshold === 'number' ? rule.semanticThreshold : 0.78,
    synonyms: buildAutoSynonyms(phrases),
  }
}

export function normalizeGuardrailRules(rules: GuardrailRule[] | undefined): GuardrailRule[] {
  const normalized = (rules ?? []).map(normalizeGuardrailRule).filter((rule) => rule.phrases.length > 0)
  return normalized.length > 0 ? normalized : [defaultGuardrailRule()]
}

export function defaultGuardrailRule(): GuardrailRule {
  return {
    id: DEFAULT_RULE_ID,
    label: DEFAULT_RULE_LABEL,
    enabled: true,
    phrases: [],
    matchMode: 'substring',
    fuzzyThreshold: 0.85,
    semanticThreshold: 0.78,
    synonyms: [],
  }
}

export function createGuardrailRule(index: number): GuardrailRule {
  return {
    id: `rule-${index + 1}`,
    label: `Nhóm chặn ${index + 1}`,
    enabled: true,
    phrases: [],
    matchMode: 'substring',
    fuzzyThreshold: 0.85,
    semanticThreshold: 0.78,
    synonyms: [],
  }
}

export function rulesAreEqual(left: GuardrailRule[], right: GuardrailRule[]): boolean {
  return JSON.stringify(normalizeGuardrailRules(left)) === JSON.stringify(normalizeGuardrailRules(right))
}

export function countActivePhrases(rules: GuardrailRule[]): number {
  return normalizeGuardrailRules(rules)
    .filter((rule) => rule.enabled !== false)
    .reduce((total, rule) => total + rule.phrases.length, 0)
}

export function matchModeLabel(mode: GuardrailMatchMode | undefined): string {
  return MATCH_MODE_OPTIONS.find((option) => option.value === (mode ?? 'substring'))?.label ?? 'Khớp chuỗi con'
}
