import type { GuardrailMatchMode, GuardrailRule } from '../api/admin'
import { normalizeGuardrailRules } from './guardrailRules'
import { previewPolicyReviewBlock } from './guardrailPolicyPreview'

export interface GuardrailPreviewMatch {
  ruleId: string
  ruleLabel: string
  matchedPhrase: string
  matchLayer: 'substring' | 'synonym' | 'fuzzy' | 'semantic' | 'policy'
  score: number
}

const FUZZY_DEFAULT_THRESHOLD = 0.85

export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length

  const rows = left.length + 1
  const cols = right.length + 1
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      )
    }
  }

  return matrix[rows - 1][cols - 1]
}

function partialRatio(left: string, right: string): number {
  const foldedLeft = foldText(left)
  const foldedRight = foldText(right)
  if (!foldedLeft || !foldedRight) return 0
  if (foldedLeft.includes(foldedRight) || foldedRight.includes(foldedLeft)) {
    return 1
  }

  const shorter = foldedLeft.length <= foldedRight.length ? foldedLeft : foldedRight
  const longer = foldedLeft.length <= foldedRight.length ? foldedRight : foldedLeft
  let best = 0

  for (let index = 0; index <= longer.length - shorter.length; index += 1) {
    const window = longer.slice(index, index + shorter.length)
    const distance = levenshtein(shorter, window)
    const score = (shorter.length - distance) / shorter.length
    if (score > best) best = score
  }

  return best
}

function substringModes(mode: GuardrailMatchMode | undefined): boolean {
  return !mode || mode === 'substring' || mode === 'exact'
}

function allPhrases(rule: GuardrailRule): Array<{ phrase: string; layer: 'substring' | 'synonym' }> {
  const phrases = (rule.phrases ?? []).map((phrase) => ({
    phrase,
    layer: 'substring' as const,
  }))
  const synonyms = (rule.synonyms ?? []).map((phrase) => ({
    phrase,
    layer: 'synonym' as const,
  }))
  return [...phrases, ...synonyms]
}

function matchSubstringLayer(
  query: string,
  rules: GuardrailRule[],
): GuardrailPreviewMatch | null {
  const foldedQuery = foldText(query)
  for (const rule of rules) {
    if (!rule.enabled || !substringModes(rule.matchMode)) continue
    for (const entry of allPhrases(rule)) {
      if (foldedQuery.includes(foldText(entry.phrase))) {
        return {
          ruleId: rule.id,
          ruleLabel: rule.label,
          matchedPhrase: entry.phrase,
          matchLayer: entry.layer,
          score: 1,
        }
      }
    }
  }
  return null
}

function matchFuzzyLayer(
  query: string,
  rules: GuardrailRule[],
): GuardrailPreviewMatch | null {
  let best: GuardrailPreviewMatch | null = null
  for (const rule of rules) {
    if (!rule.enabled || rule.matchMode !== 'fuzzy') continue
    const threshold = rule.fuzzyThreshold ?? FUZZY_DEFAULT_THRESHOLD
    for (const entry of allPhrases(rule)) {
      const score = partialRatio(query, entry.phrase)
      if (score < threshold) continue
      if (!best || score > best.score) {
        best = {
          ruleId: rule.id,
          ruleLabel: rule.label,
          matchedPhrase: entry.phrase,
          matchLayer: entry.layer === 'synonym' ? 'synonym' : 'fuzzy',
          score,
        }
      }
    }
  }
  return best
}

export function previewGuardrailMatch(
  query: string,
  rules: GuardrailRule[],
  options?: { enabled?: boolean },
): GuardrailPreviewMatch | null {
  if (options?.enabled === false) return null
  const trimmed = query.trim()
  if (!trimmed) return null

  const normalized = normalizeGuardrailRules(rules)
  return (
    matchSubstringLayer(trimmed, normalized) ??
    matchFuzzyLayer(trimmed, normalized) ??
    previewPolicyReviewBlock(trimmed)
  )
}

export function previewLayerLabel(layer: GuardrailPreviewMatch['matchLayer']): string {
  switch (layer) {
    case 'substring':
      return 'Khớp chuỗi con'
    case 'synonym':
      return 'Khớp từ đồng nghĩa'
    case 'fuzzy':
      return 'Khớp mờ (typo)'
    case 'semantic':
      return 'Khớp ngữ nghĩa'
    case 'policy':
      return 'Phân tích ngữ cảnh (policy)'
    default:
      return layer
  }
}
