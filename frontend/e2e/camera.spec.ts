import { expect, test } from '@playwright/test'
import { calibrate, interview, startVisit } from './helpers'

// Runs with a fake camera. The fake picture has no face, so the guard cannot say "OK",
// but it must mount, load the local MediaPipe files, and never call anything outside the server.
test('distance guard mounts with a camera and uses only local files', async ({ page }) => {
  const errors: string[] = []
  const external: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.hostname !== 'localhost') external.push(r.url())
  })

  await startVisit(page, 'en', { fakeCamera: true })
  await calibrate(page)
  await interview(page)

  const bar = page.getByTestId('guard-status')
  await expect(bar).toBeVisible()
  // leaves "loading" once the camera and the local model are up
  await expect.poll(async () => bar.getAttribute('data-status'), { timeout: 30000 }).not.toBe('loading')
  const status = await bar.getAttribute('data-status')
  expect(['noface', 'ok', 'close', 'far', 'turn', 'failed']).toContain(status)
  // with no face the test must stay hidden: the answer buttons are disabled
  await page.getByTestId('chart-start').click()
  await expect(page.getByTestId('dir-up')).toBeDisabled()

  expect(errors).toEqual([])
  expect(external).toEqual([])
})
