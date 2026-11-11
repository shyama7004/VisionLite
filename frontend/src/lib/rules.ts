// Rules only recommendation engine. Mirror of backend/app/services/recommend/rules.py.
// Both read shared/rules.json, and both are tested with shared/fixtures/recommendation_cases.json.
// The engine returns codes only. Screens and the PDF turn codes into text.
import rules from '../../../shared/rules.json'
import type { Range, Recommendation, Session } from './types'

const EPS = 1e-9
const RED_FLAG_CODES: Record<string, string> = {
  sudden_vision_change: 'RED_FLAG_SUDDEN',
  eye_pain_or_redness: 'RED_FLAG_PAIN',
  flashes_or_floaters: 'RED_FLAG_FLASHES',
  double_vision: 'RED_FLAG_DOUBLE',
  diabetes: 'RED_FLAG_DIABETES',
  eye_injury_or_surgery: 'RED_FLAG_INJURY',
}

export function roundStep(v: number, step = rules.power_clamp.step): number {
  return Math.round(v / step) * step
}

/** Round to 0.25, clamp, and make the range at least min_range_width wide. */
export function cleanRange(a: number, b: number): Range {
  const c = rules.power_clamp
  let low = roundStep(a)
  let high = roundStep(b)
  const dir = high < low ? -1 : high > low ? 1 : -1
  if (Math.abs(high - low) < c.min_range_width - EPS) high = low + dir * c.min_range_width
  low = Math.min(c.max, Math.max(c.min, low))
  high = Math.min(c.max, Math.max(c.min, high))
  return { low, high }
}

export function rulesOnlySphere(logmar: number): Range | null {
  for (const row of rules.rules_only_sphere) {
    if (logmar >= row.from - EPS && logmar <= row.to + EPS) return cleanRange(row.low, row.high)
  }
  return null
}

export function readingAdd(age: number): Range {
  const p = rules.presbyopia
  let centre = p.add_by_age[0][2]
  for (const [lo, hi, add] of p.add_by_age) if (age >= lo && age <= hi) centre = add
  return cleanAdd(centre - p.add_range_half_width, centre + p.add_range_half_width)
}
function cleanAdd(a: number, b: number): Range {
  return { low: roundStep(a), high: roundStep(b) }
}

export function recommendRules(s: Partial<Session> & Record<string, any>): Recommendation {
  const iv = s.interview
  const age: number = iv?.age ?? 30
  const R = rules.referral
  const chart = s.tests?.chart
  const eyeR: number | null = chart?.right?.logmar ?? null
  const eyeL: number | null = chart?.left?.logmar ?? null
  const near: number | null = s.tests?.near?.logmar ?? null
  const eyes = [eyeR, eyeL].filter((x): x is number => x !== null)
  const better = eyes.length ? Math.min(...eyes) : null
  const worst = eyes.length ? Math.max(...eyes) : null

  // Skipped tests
  const skipped: string[] = []
  if (eyeR === null || eyeL === null) skipped.push('chart')
  if (near === null) skipped.push('near')
  if (!s.tests?.astig?.right && !s.tests?.astig?.left) skipped.push('astig')
  if (!s.tests?.color) skipped.push('color')
  const bothChartsSkipped = eyes.length === 0

  // 1. Referral
  const refer: string[] = []
  let blocks = false
  const flags = iv?.red_flags ?? {}
  for (const [key, code] of Object.entries(RED_FLAG_CODES)) {
    if ((flags as any)[key]) {
      refer.push(code)
      if (R.block_if_any_red_flag) blocks = true
    }
  }
  if (age < R.min_age_for_lens_advice) {
    refer.push('AGE_TOO_YOUNG')
    blocks = true
  }
  if (worst !== null && worst >= R.any_eye_logmar_refer_at_or_above - EPS) {
    refer.push('EYE_VERY_LOW')
    blocks = true
  }
  if (better !== null && better >= R.better_eye_logmar_refer_at_or_above - EPS && !refer.includes('EYE_VERY_LOW')) {
    refer.push('BETTER_EYE_LOW')
  }
  if (eyeR !== null && eyeL !== null && Math.abs(eyeR - eyeL) >= R.eye_difference_refer_at_or_above - EPS) {
    refer.push('EYE_DIFFERENCE_LARGE')
  }
  const overdue =
    iv != null && age >= R.advise_exam_min_age && R.advise_exam_if_last_exam_in.includes(iv.last_eye_exam)
  let level: 'none' | 'advise' | 'refer' = 'none'
  const reasons = [...refer]
  if (refer.length) level = 'refer'
  else if (overdue) {
    level = 'advise'
    reasons.push('EXAM_OVERDUE')
  }

  const astigHint = !!(s.tests?.astig?.right?.unequal || s.tests?.astig?.left?.unequal)
  const colorHint = !!(s.tests?.color && !s.tests.color.invalid && s.tests.color.flag)
  const frame = { pd_mm: s.photo?.pd_mm ?? null, size: s.photo?.frame_size ?? null }
  const base = { astigmatism_hint: astigHint, color_hint: colorHint, frame, skipped, disclaimer_key: 'disclaimer_default' }

  // 2. Blocked
  if (blocks) {
    return {
      referral: { level, reasons, blocks_lens_advice: true },
      lens: { type: 'NONE_UNTIL_DOCTOR', reasons: [] },
      power: { right: null, left: null, add: null, source: 'none' },
      coatings: [],
      ...base,
    }
  }

  // 3. Lens type
  const lensReasons: string[] = []
  const distanceProblem = better !== null && better >= rules.distance_problem_logmar_at_or_above - EPS
  const P = rules.presbyopia
  const nearProblem =
    near !== null &&
    ((age >= P.min_age && near > P.near_logmar_worse_than + EPS) || (better !== null && near - better >= 0.3 - EPS))
  let type: string
  if (distanceProblem && nearProblem && age >= 40) type = 'PROGRESSIVE_OR_BIFOCAL'
  else if (distanceProblem) type = 'SINGLE_VISION_DISTANCE'
  else if (nearProblem) type = 'SINGLE_VISION_NEAR'
  else type = 'NO_CORRECTION_LIKELY'
  if (distanceProblem) lensReasons.push('DISTANCE_PROBLEM')
  if (nearProblem) lensReasons.push('NEAR_PROBLEM')
  if (type === 'NO_CORRECTION_LIKELY') lensReasons.push('NO_PROBLEM', 'RECHECK_YEARLY')
  if (bothChartsSkipped) lensReasons.push('BOTH_CHARTS_SKIPPED')

  // 4. Power range (rules only here; the server may replace the sphere with the model)
  let right: Range | null = null
  let left: Range | null = null
  let add: Range | null = null
  if (type === 'SINGLE_VISION_DISTANCE' || type === 'PROGRESSIVE_OR_BIFOCAL') {
    right = eyeR !== null ? rulesOnlySphere(eyeR) : null
    left = eyeL !== null ? rulesOnlySphere(eyeL) : null
  }
  if (type === 'SINGLE_VISION_NEAR' || type === 'PROGRESSIVE_OR_BIFOCAL') add = readingAdd(age)
  const source = right || left || add ? 'rules' : 'none'

  // 5. Coatings
  const coatings: { name: string; why: string }[] = []
  const screen6 = iv?.screen_hours === '6to9' || iv?.screen_hours === 'gt9'
  if (iv?.night_driving_trouble === 'yes') coatings.push({ name: 'anti_glare', why: 'night_driving_trouble' })
  else if (screen6) coatings.push({ name: 'anti_glare', why: 'screen_hours_6plus' })
  if (screen6) coatings.push({ name: 'blue_light', why: 'screen_hours_6plus' })

  return {
    referral: { level, reasons, blocks_lens_advice: false },
    lens: { type, reasons: lensReasons },
    power: { right, left, add, source },
    coatings,
    ...base,
  }
}

export function formatRange(r: Range | null): string {
  if (!r) return ''
  const f = (n: number) => (n > 0 ? '+' : '') + n.toFixed(2)
  return `${f(r.low)} ~ ${f(r.high)}`
}
