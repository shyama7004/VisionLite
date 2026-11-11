export type Lang = 'en' | 'hi' | 'or'

export interface RedFlags {
  sudden_vision_change: boolean
  eye_pain_or_redness: boolean
  flashes_or_floaters: boolean
  double_vision: boolean
  diabetes: boolean
  eye_injury_or_surgery: boolean
}

export interface Interview {
  age: number
  screen_hours: 'lt2' | '2to5' | '6to9' | 'gt9'
  headaches: 'never' | 'sometimes' | 'often'
  night_driving_trouble: 'yes' | 'no' | 'does_not_drive'
  wears_glasses: boolean
  glasses_age: 'lt1' | '1to2' | 'gt2' | null
  last_eye_exam: 'never' | 'lt1' | '1to2' | 'gt2'
  red_flags: RedFlags
}

export interface LineResultT {
  logmar: number
  shown: number
  correct: number
  passed: boolean
}
export interface ChartResult {
  logmar: number
  line_results: LineResultT[]
  tested_with_glasses?: boolean
  distance_source?: 'camera' | 'tape'
}
export interface AstigResult {
  unequal: boolean
  darkest_deg: number | null
}
export interface ColorResult {
  plates_shown: number
  plates_correct: number
  flag: boolean
  invalid?: boolean
  seed?: number
}
export interface PhotoResult {
  pd_mm: number | null
  face_width_mm: number | null
  frame_size: 'small' | 'medium' | 'large' | null
  source: 'face' | 'glasses'
}

// null means "skipped or not done".
export interface Session {
  id: string
  created_at: string
  language: Lang
  consent: boolean
  customer: { name: string | null; phone: string | null }
  interview: Interview | null
  calibration: { px_per_mm: number; screen_key: string } | null
  tests: {
    chart: { right: ChartResult | null; left: ChartResult | null }
    near: ChartResult | null
    astig: { right: AstigResult | null; left: AstigResult | null }
    color: ColorResult | null
  }
  photo: PhotoResult | null
  distance_log: { test: string; median_mm: number | null; within_range: boolean; source?: string }[]
}

export interface Range {
  low: number
  high: number
}
export interface Recommendation {
  referral: { level: 'none' | 'advise' | 'refer'; reasons: string[]; blocks_lens_advice: boolean }
  lens: { type: string; reasons: string[] }
  power: { right: Range | null; left: Range | null; add: Range | null; source: 'model' | 'rules' | 'none' }
  coatings: { name: string; why: string }[]
  astigmatism_hint: boolean
  color_hint: boolean
  frame: { pd_mm: number | null; size: string | null }
  skipped: string[]
  disclaimer_key: string
}
