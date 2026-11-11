import { expect, test } from '@playwright/test'
import { calibrate, fullVisit, interview, savedSession, startVisit } from './helpers'

test('full visit in English ends with a saved session and a PDF', async ({ page, request }) => {
  await fullVisit(page, 'en')
  await expect(page.getByTestId('lens-type')).toBeVisible()
  await expect(page.getByTestId('disclaimer')).toContainText('does not diagnose')

  const s = await savedSession(page)
  expect(s.calibration.px_per_mm).toBeGreaterThan(5)
  expect(s.tests.chart.right.logmar).toBeCloseTo(0.4, 5) // passed 7 lines: 1.0 down to 0.4
  expect(s.tests.near.logmar).toBeDefined()
  expect(s.tests.astig.right.unequal).toBe(true)
  expect(s.tests.astig.left.unequal).toBe(false)
  expect(s.tests.color.flag).toBe(false)
  expect(s.interview.age).toBe(34)

  // The server has the visit (saved a moment after the last change).
  await expect.poll(async () => (await request.get(`/api/sessions/${s.id}`)).status(), { timeout: 15000 }).toBe(200)
  const pdf = await request.get(`/api/sessions/${s.id}/report.pdf`)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toContain('application/pdf')
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')
})

test('a red flag shows the referral banner and no lens advice', async ({ page }) => {
  await startVisit(page, 'en')
  await calibrate(page)
  await page.getByTestId('age-input').fill('45')
  await page.getByTestId('age-ok').click()
  // answer the 7 normal questions, then say yes to diabetes
  for (const id of ['ans-2to5', 'ans-never', 'ans-no', 'ans-no', 'ans-lt1']) await page.getByTestId(id).click()
  for (const id of ['ans-no', 'ans-no', 'ans-no', 'ans-no', 'ans-yes', 'ans-no']) await page.getByTestId(id).click()
  for (const step of ['chart', 'chart', 'near', 'astig', 'astig', 'color']) await page.getByTestId('skip').click()
  await page.getByTestId('photo-continue').click()
  await expect(page.getByTestId('refer-banner')).toBeVisible()
  await expect(page.getByTestId('lens-card')).toHaveCount(0)
  await expect(page.getByTestId('skipped')).toBeVisible()
})

test('skipping every test is allowed and the result says so', async ({ page }) => {
  await startVisit(page, 'en')
  await calibrate(page)
  await interview(page)
  for (let i = 0; i < 6; i++) await page.getByTestId('skip').click()
  await page.getByTestId('photo-continue').click()
  await expect(page.getByTestId('skipped')).toContainText('Distance chart')
})

test('a refresh does not lose the visit', async ({ page }) => {
  await startVisit(page, 'en')
  await calibrate(page)
  await page.getByTestId('age-input').fill('50')
  await page.getByTestId('age-ok').click()
  await page.reload()
  await expect(page.getByTestId('question')).toBeVisible()
  const s = await savedSession(page)
  expect(s.interview.age).toBe(50)
})
