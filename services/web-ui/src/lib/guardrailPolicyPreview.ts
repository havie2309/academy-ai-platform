import { foldText } from './guardrailPreview'

const UPCOMING_SIGNALS = [
  'tuan toi',
  'tuan sau',
  'nam toi',
  'nam sau',
  'sap toi',
  'ky nay',
  'hom nay',
  'ngay mai',
]
const PRACTICE_EXAM_SIGNALS = [
  'de thi thu',
  'de thu',
  'de luyen',
  'bai luyen',
  'on tap',
  'luyen thi',
  'luyen tap',
]
const PUBLICATION_ALLOW_SIGNALS = [
  'cong khai',
  'da cong bo',
  'phat cho hoc sinh',
  'hoc sinh luyen',
  'de luyen tap',
  'bai luyen tap',
  'da phat hanh',
]
const LEAK_OVERRIDE_SIGNALS = [
  'dap an',
  'de thi mat',
  'lo de',
  'bi ro ri',
  'key de thi',
]

function hasLeakOverrideSignal(folded: string): boolean {
  return LEAK_OVERRIDE_SIGNALS.some((signal) => folded.includes(signal))
}

export function isPublicPracticeAllowQuery(query: string): boolean {
  const folded = foldText(query)
  if (hasLeakOverrideSignal(folded)) return false
  if (PRACTICE_EXAM_SIGNALS.some((signal) => folded.includes(signal))) return true
  const publication = PUBLICATION_ALLOW_SIGNALS.some((signal) => folded.includes(signal))
  const examContext = ['de thi', 'bai kiem tra', 'bai thi'].some((token) =>
    folded.includes(token),
  )
  return publication && examContext
}

export function isOfficialUpcomingExamQuery(query: string): boolean {
  const folded = foldText(query)
  if (isPublicPracticeAllowQuery(query)) return false
  const examHit =
    folded.includes('de thi') ||
    folded.includes('bai kiem tra') ||
    folded.includes('bai thi')
  const upcomingHit = UPCOMING_SIGNALS.some((signal) => folded.includes(signal))
  return examHit && upcomingHit
}

export function previewPolicyReviewBlock(query: string): {
  ruleId: string
  ruleLabel: string
  matchedPhrase: string
  matchLayer: 'policy'
  score: number
} | null {
  if (isPublicPracticeAllowQuery(query)) return null
  if (!isOfficialUpcomingExamQuery(query)) return null
  return {
    ruleId: 'policy-judge',
    ruleLabel: 'Phân tích ngữ cảnh thi',
    matchedPhrase: 'đề thi chính thức sắp tới',
    matchLayer: 'policy',
    score: 0.9,
  }
}
