import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { recommendRules } from '../src/lib/rules'
import en from '../src/i18n/en.json'
import hi from '../src/i18n/hi.json'
import or from '../src/i18n/or.json'

const fixtures = JSON.parse(readFileSync('../shared/fixtures/recommendation_cases.json', 'utf-8'))

describe('rules engine matches the shared fixtures', () => {
  for (const c of fixtures.cases) {
    it(c.name, () => {
      const out: any = recommendRules(c.input)
      const e = c.expected
      expect(out.referral.level).toBe(e.referral.level)
      expect([...out.referral.reasons].sort()).toEqual([...e.referral.reasons].sort())
      expect(out.referral.blocks_lens_advice).toBe(e.referral.blocks_lens_advice)
      expect(out.lens.type).toBe(e.lens.type)
      expect(out.coatings).toEqual(e.coatings)
      expect(out.power).toEqual(e.power)
      expect(out.astigmatism_hint).toBe(e.astigmatism_hint)
      expect(out.color_hint).toBe(e.color_hint)
      expect(out.skipped).toEqual(e.skipped)
      for (const r of e.lens_reasons_include ?? []) expect(out.lens.reasons).toContain(r)
    })
  }
  it('has at least 15 cases', () => expect(fixtures.cases.length).toBeGreaterThanOrEqual(15))
})

describe('safety text scan', () => {
  // "prescription" is only allowed in the sentence that says it is NOT one.
  const banned = [/diagnosis/i, /you have/i, /disease/i, /बीमारी/, /(?<![଀-୿])ରୋଗ/]
  for (const [name, file] of Object.entries({ en, hi, or })) {
    it(`${name} has no banned phrases`, () => {
      for (const [k, v] of Object.entries(file) as [string, string][]) {
        for (const b of banned) expect(b.test(v), `${name}.${k}: ${v}`).toBe(false)
        if (/prescription/i.test(v)) expect(v).toMatch(/not a prescription/i)
      }
    })
    it(`${name} has the disclaimer and the rough range note`, () => {
      expect(file.disclaimer_default.length).toBeGreaterThan(20)
      expect(file.res_power_note.length).toBeGreaterThan(10)
    })
  }
})
