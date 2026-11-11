import rules from '../../../shared/rules.json'

export const CARD_W = rules.card_mm.width
export const CARD_H = rules.card_mm.height

/** A phone gives roughly 5 to 8 css px per mm. Outside 3 to 12 means a bad calibration. */
export function pxPerMmFromWidth(widthPx: number): number {
  return widthPx / CARD_W
}
export function isPlausible(pxPerMm: number): boolean {
  return pxPerMm >= 3 && pxPerMm <= 12
}

export function screenKey(): string {
  return `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`
}

const KEY = 'visionlite.calibration'

export interface SavedCal {
  px_per_mm: number
  screen_key: string
}

export function loadCalibration(): SavedCal | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SavedCal | null
    return v && v.screen_key === screenKey() ? v : null
  } catch {
    return null
  }
}

export function saveCalibration(px_per_mm: number): SavedCal {
  const c = { px_per_mm, screen_key: screenKey() }
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* private window: just keep it in memory */
  }
  return c
}
