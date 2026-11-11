import { expect, test } from '@playwright/test'
import { fullVisit, savedSession } from './helpers'

test('app works offline after the first load, and the visit syncs when back online', async ({ page, context, request }) => {
  await page.goto('/')
  // Wait until the service worker has cached the app files.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect.poll(async () => page.evaluate(async () => (await caches.keys()).length), { timeout: 60000 }).toBeGreaterThan(0)
  await expect
    .poll(async () => page.evaluate(async () => {
      const k = (await caches.keys())[0]
      return (await (await caches.open(k)).keys()).length
    }), { timeout: 60000 })
    .toBeGreaterThanOrEqual(10)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByTestId('start')).toBeVisible()

  await fullVisit(page, 'en')
  // Rules only result, printed layout available, no server call possible.
  await expect(page.getByTestId('lens-type')).toBeVisible()
  await expect(page.getByTestId('offline-note')).toBeVisible()
  await expect(page.getByTestId('pdf')).toBeDisabled()
  await expect(page.getByTestId('print')).toBeEnabled()
  const s = await savedSession(page)

  // Nothing reached the server while offline.
  expect((await request.get(`/api/sessions/${s.id}`)).status()).toBe(404)

  await context.setOffline(false)
  await expect.poll(async () => (await request.get(`/api/sessions/${s.id}`)).status(), { timeout: 30000 }).toBe(200)
})
