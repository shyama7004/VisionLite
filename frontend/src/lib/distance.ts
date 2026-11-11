import rules from '../../../shared/rules.json'

// Distance from the camera, using the size of the iris. Pinhole camera model.
export const IRIS_MM = rules.iris_diameter_mm
export const TOLERANCE = rules.distance_tolerance
export const DEFAULT_HFOV_DEG = 65

export interface Pt {
  x: number
  y: number
}

export function focalFromFov(videoWidthPx: number, hfovDeg = DEFAULT_HFOV_DEG): number {
  return videoWidthPx / 2 / Math.tan((hfovDeg * Math.PI) / 360)
}

/** distance_mm = focal_px * iris_mm / iris_px */
export function distanceMm(irisPx: number, focalPx: number, irisMm = IRIS_MM): number {
  return (focalPx * irisMm) / irisPx
}

/** Camera calibration: card held at a known distance, card width measured in pixels. */
export function focalFromCard(cardPx: number, knownDistanceMm = 400, cardMm = rules.card_mm.width): number {
  return (cardPx * knownDistanceMm) / cardMm
}

export function median(v: number[]): number {
  if (v.length === 0) return NaN
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export type DistStatus = 'ok' | 'close' | 'far'

export function statusFor(d: number, target: number, tol = TOLERANCE): DistStatus {
  if (d < target * (1 - tol)) return 'close'
  if (d > target * (1 + tol)) return 'far'
  return 'ok'
}

const dist = (a: Pt, b: Pt, w: number, h: number) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h)

/**
 * Horizontal iris diameter in pixels, averaged over both eyes.
 * Landmarks: right iris 468 (centre) 469 471 (left/right edge), left iris 473 (centre) 474 476.
 */
export function irisDiameterPx(lm: Pt[], w: number, h: number): number | null {
  if (lm.length < 478) return null
  const r = dist(lm[469], lm[471], w, h)
  const l = dist(lm[474], lm[476], w, h)
  const avg = (r + l) / 2
  return avg > 1 ? avg : null
}

/** Head turned more than about 20 degrees: the nose is far from the middle of the eyes. */
export function isTurned(lm: Pt[]): boolean {
  const left = lm[33]
  const right = lm[263]
  const nose = lm[1]
  const mid = (left.x + right.x) / 2
  const span = Math.abs(right.x - left.x)
  return span > 0 && Math.abs(nose.x - mid) / span > 0.17
}

const KEY = 'visionlite.focal'
/** Saved per device by the camera calibration screen. Scales with the video width. */
export function loadFocal(videoWidthPx: number): number {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { focal: number; width: number } | null
    if (s && s.width > 0) return (s.focal * videoWidthPx) / s.width
  } catch {
    /* ignore */
  }
  return focalFromFov(videoWidthPx)
}
export function saveFocal(focal: number, videoWidthPx: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ focal, width: videoWidthPx }))
  } catch {
    /* ignore */
  }
}
