import { describe, expect, it } from 'vitest'
import { distanceMm, focalFromCard, focalFromFov, irisDiameterPx, isTurned, median, statusFor } from '../src/lib/distance'
import { nearestLineDeg } from '../src/screens/TestAstig'

describe('distance from iris size', () => {
  it('iris 29 px with focal 1000 px is about 403 mm', () => {
    expect(distanceMm(29, 1000)).toBeCloseTo(403.4, 0)
  })
  it('default field of view 65 degrees gives a sensible focal length', () => {
    expect(focalFromFov(1280)).toBeCloseTo(1005, -1)
  })
  it('card calibration: 85.6 mm card at 400 mm that is 856 px wide gives focal 4000', () => {
    expect(focalFromCard(856)).toBeCloseTo(4000, 5)
  })
  it('median ignores one wild value', () => {
    expect(median([400, 410, 2000, 405, 395])).toBe(405)
  })
})

describe('distance status', () => {
  it('is ok within 15 percent, close below, far above', () => {
    expect(statusFor(1000, 1000)).toBe('ok')
    expect(statusFor(860, 1000)).toBe('ok')
    expect(statusFor(840, 1000)).toBe('close')
    expect(statusFor(1160, 1000)).toBe('far')
  })
})

describe('face geometry helpers', () => {
  const pts = (shift = 0) => {
    const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
    lm[33] = { x: 0.4, y: 0.5 }
    lm[263] = { x: 0.6, y: 0.5 }
    lm[1] = { x: 0.5 + shift, y: 0.6 }
    lm[469] = { x: 0.43, y: 0.5 }
    lm[471] = { x: 0.45, y: 0.5 }
    lm[474] = { x: 0.55, y: 0.5 }
    lm[476] = { x: 0.57, y: 0.5 }
    return lm
  }
  it('averages the iris width of both eyes in pixels', () => {
    expect(irisDiameterPx(pts(), 1000, 1000)).toBeCloseTo(20, 5)
  })
  it('detects a turned head', () => {
    expect(isTurned(pts(0))).toBe(false)
    expect(isTurned(pts(0.05))).toBe(true)
  })
})

describe('astigmatism dial tap', () => {
  it('maps taps to the nearest 10 degree line', () => {
    expect(nearestLineDeg(100, 0)).toBe(0) // right = horizontal line
    expect(nearestLineDeg(0, -100)).toBe(90) // up = vertical line
    expect(nearestLineDeg(0, 100)).toBe(90) // down = same line
    expect(nearestLineDeg(100, -100)).toBe(50) // 45 degrees is halfway and rounds up
  })
})
