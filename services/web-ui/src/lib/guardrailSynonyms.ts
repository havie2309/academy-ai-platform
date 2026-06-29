import { foldText } from './guardrailPreview'

const EXPANSION_RULES: Array<{
  includes: string[]
  extras: string[]
}> = [
  {
    includes: ['de thi', 'dap an'],
    extras: [
      'bai kiem tra',
      'bai thi',
      'de thi sap toi',
      'dap an bai thi',
      'dap an de thi',
      'de thi bi ro ri',
      'lo de thi',
    ],
  },
  {
    includes: ['mat khau', 'pass', 'key he thong'],
    extras: ['pass admin', 'key he thong', 'mat khau he thong', 'tai lieu mat'],
  },
  {
    includes: ['bypass', 'vuot quyen'],
    extras: ['bypass quyen', 'vuot quyen truy cap'],
  },
]

function stripAccents(value: string): string {
  return foldText(value)
}

function addUnique(
  target: string[],
  seen: Set<string>,
  value: string,
  phraseKeys: Set<string>,
) {
  const trimmed = value.trim()
  if (!trimmed) return
  const key = foldText(trimmed)
  if (!key || seen.has(key) || phraseKeys.has(key)) return
  seen.add(key)
  target.push(trimmed)
}

export function buildAutoSynonyms(phrases: string[]): string[] {
  const phraseKeys = new Set(phrases.map((phrase) => foldText(phrase)))
  const seen = new Set<string>()
  const synonyms: string[] = []

  for (const phrase of phrases) {
    const folded = foldText(phrase)
    if (!folded) continue

    const compact = stripAccents(phrase)
    if (compact && compact !== phrase.trim()) {
      addUnique(synonyms, seen, compact, phraseKeys)
    }

    for (const rule of EXPANSION_RULES) {
      if (!rule.includes.some((token) => folded.includes(token))) continue
      for (const extra of rule.extras) {
        addUnique(synonyms, seen, extra, phraseKeys)
      }
    }
  }

  return synonyms
}
