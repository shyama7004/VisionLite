import { describe, expect, it } from 'vitest'
import { ChartRun, CHART_LINES, heightMm, heightPx, passNeeded, randomDirs, symbolsThatFit } from '../src/lib/optotype'
import { makeRng } from '../src/lib/rng'
import { generatePlate, inDigitMask, plateDigits, scoreColor } from '../src/lib/plates'
import { isPlausible, pxPerMmFromWidth } from '../src/lib/calibration'
import en from '../src/i18n/en.json'
import hi from '../src/i18n/hi.json'
import or from '../src/i18n/or.json'

describe('optotype size', () => {
  it('matches the spec examples at 1 m', () => {
    expect(heightMm(1000, 0)).toBeCloseTo(1.454, 2)
    expect(heightMm(1000, 0.5)).toBeCloseTo(4.6, 1)
    expect(heightMm(1000, 1.0)).toBeCloseTo(14.54, 1)
  })
  it('gives about 8.9 px and 28 px at 6.1 px/mm', () => {
    expect(heightPx(1000, 0, 6.1)).toBeCloseTo(8.87, 1)
    expect(heightPx(1000, 0.5, 6.1)).toBeCloseTo(28.05, 0)
  })
  it('has eleven chart lines from 1.0 to 0.0', () => {
    expect(CHART_LINES).toHaveLength(11)
    expect(CHART_LINES[0]).toBe(1.0)
    expect(CHART_LINES[10]).toBe(0.0)
  })
})

describe('line layout', () => {
  it('shows 5 symbols when they fit, then 3, then 1', () => {
    expect(symbolsThatFit(10, 360)).toBe(5)
    expect(symbolsThatFit(50, 360)).toBe(3)
    expect(symbolsThatFit(100, 360)).toBe(1)
  })
  it('pass rule is 60 percent rounded up', () => {
    expect([passNeeded(5), passNeeded(3), passNeeded(1)]).toEqual([3, 2, 1])
  })
  it('never repeats a direction more than twice', () => {
    const d = randomDirs(200, makeRng(3))
    for (let i = 2; i < d.length; i++) expect(d[i] === d[i - 1] && d[i] === d[i - 2]).toBe(false)
  })
})

function run(passesBeforeFail: number) {
  const r = new ChartRun(CHART_LINES, 6.1, 1000, 360, 1)
  let lines = 0
  while (!r.finished) {
    const ok = lines < passesBeforeFail
    const dirs = [...r.dirs]
    let done = false
    for (let i = 0; i < dirs.length && !done; i++) {
      done = r.answer(ok ? dirs[i] : null)
    }
    lines++
  }
  return r
}

describe('chart scoring', () => {
  it('stops at the first failed line and returns the smallest passed line', () => {
    expect(run(3).result).toBe(0.8) // passed 1.0, 0.9, 0.8
  })
  it('stores 1.1 when the first line fails', () => {
    expect(run(0).result).toBe(1.1)
  })
  it('stores 0.0 when every line passes', () => {
    expect(run(99).result).toBe(0.0)
  })
  it('passes with 3 of 5 right', () => {
    const r = new ChartRun(CHART_LINES, 6.1, 1000, 1200, 2)
    expect(r.dirs).toHaveLength(5)
    const d = [...r.dirs]
    r.answer(d[0]); r.answer(d[1]); r.answer(d[2]); r.answer(null); r.answer(null)
    expect(r.results[0].passed).toBe(true)
    expect(r.lineIdx).toBe(1)
  })
})

describe('calibration', () => {
  it('computes px per mm and checks it is plausible', () => {
    expect(pxPerMmFromWidth(522.16)).toBeCloseTo(6.1, 2)
    expect(isPlausible(6.1)).toBe(true)
    expect(isPlausible(2)).toBe(false)
    expect(isPlausible(13)).toBe(false)
  })
})

describe('colour plates', () => {
  const p = generatePlate(42, 7, false, 320)
  it('keeps every dot inside the circle', () => {
    for (const d of p.dots) expect(Math.hypot(d.x - 160, d.y - 160) + d.r).toBeLessThanOrEqual(160)
  })
  it('has no overlapping dots', () => {
    for (let i = 0; i < p.dots.length; i++)
      for (let j = i + 1; j < p.dots.length; j++)
        expect(Math.hypot(p.dots[i].x - p.dots[j].x, p.dots[i].y - p.dots[j].y)).toBeGreaterThanOrEqual(p.dots[i].r + p.dots[j].r)
  })
  it('has dots inside and outside the digit, and agrees with the mask', () => {
    expect(p.dots.some((d) => d.inDigit)).toBe(true)
    expect(p.dots.some((d) => !d.inDigit)).toBe(true)
    for (const d of p.dots) expect(d.inDigit).toBe(inDigitMask(7, d.x / 320, d.y / 320))
  })
  it('is the same for the same seed', () => {
    expect(generatePlate(42, 7, false).dots[10]).toEqual(p.dots[10])
  })
  it('picks 6 different digits, never 0 or 1', () => {
    const d = plateDigits(5)
    expect(new Set(d).size).toBe(6)
    expect(d.every((x) => x >= 2)).toBe(true)
  })
  it('flags on 2 or more wrong among plates 2 to 6, invalid if control is wrong', () => {
    const digits = [2, 3, 4, 5, 6, 7]
    expect(scoreColor(digits, [2, 3, 4, 5, 6, 7]).flag).toBe(false)
    expect(scoreColor(digits, [2, 3, 9, 5, 6, 7]).flag).toBe(false)
    expect(scoreColor(digits, [2, 9, 9, 5, 6, 7]).flag).toBe(true)
    expect(scoreColor(digits, [9, 9, 9, 9, 9, 9])).toMatchObject({ invalid: true, flag: false })
  })
})

describe('translations', () => {
  const keys = (o: object) => Object.keys(o).sort()
  it('en, hi and or have exactly the same keys', () => {
    expect(keys(hi)).toEqual(keys(en))
    expect(keys(or)).toEqual(keys(en))
  })
  it('has no empty strings', () => {
    for (const f of [en, hi, or]) for (const v of Object.values(f)) expect((v as string).trim().length).toBeGreaterThan(0)
  })
})
