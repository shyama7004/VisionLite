import { expect, test } from '@playwright/test'
import { calibrate, interview, startVisit } from './helpers'

const TITLE = { hi: 'बातचीत', or: 'ସାକ୍ଷାତକାର' } as const
const AGE_Q = { hi: 'आपकी उम्र कितनी है?', or: 'ଆପଣଙ୍କ ବୟସ କେତେ?' } as const

for (const lang of ['hi', 'or'] as const) {
  test(`tap interview works in ${lang}`, async ({ page }) => {
    await startVisit(page, lang)
    await calibrate(page)
    await expect(page.getByRole('heading', { name: TITLE[lang] })).toBeVisible()
    await expect(page.getByTestId('question')).toHaveText(AGE_Q[lang])
    // No hi-IN / or-IN voice in headless Chromium: the app must say staff should read it, not stay silent.
    await expect(page.getByTestId('staff-read')).toBeVisible()
    const seen = await interview(page)
    expect(seen.length).toBeGreaterThanOrEqual(11)
    // Reached the first test screen (guard bar visible).
    await expect(page.getByTestId('guard-status')).toBeVisible()
  })
}

test('Odia voice button stays off by default', async ({ page }) => {
  await startVisit(page, 'or')
  await calibrate(page)
  await expect(page.getByTestId('odia-off')).toBeVisible()
  await expect(page.getByTestId('mic')).toHaveCount(0)
})
