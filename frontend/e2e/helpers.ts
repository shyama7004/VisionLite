import { expect, type Page } from '@playwright/test'

export type Lang = 'en' | 'hi' | 'or'

/** Reads the current visit from IndexedDB, where the app keeps it. */
export async function savedSession(page: Page): Promise<any> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('keyval-store')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction('keyval').objectStore('keyval').get('visionlite.state')
          get.onsuccess = () => resolve(get.result?.session)
          get.onerror = () => reject(get.error)
        }
      }),
  )
}

export async function startVisit(page: Page, lang: Lang = 'en', opts: { fakeCamera?: boolean } = {}) {
  if (!opts.fakeCamera) {
    // Simulates a phone where the camera permission was refused, so the guard fails at once.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
        configurable: true,
      })
    })
  }
  await page.goto('/?debug=1')
  await page.getByTestId(`lang-${lang}`).click()
  await page.getByTestId('start').click()
  await page.getByTestId('consent-ok').click()
}

export async function calibrate(page: Page) {
  await page.getByTestId('cal-slider').fill('330') // 330 px wide box = about 6.1 px/mm
  await page.getByTestId('cal-next').click()
  await page.getByTestId('cal-save').click()
}

/** Answers every interview question. Defaults are healthy answers. Red flags can be switched on. */
export async function interview(page: Page, opts: { age?: string; yes?: string[] } = {}) {
  const yes = new Set(opts.yes ?? [])
  const seen: string[] = []
  await page.getByTestId('age-input').fill(opts.age ?? '34')
  await page.getByTestId('age-ok').click()
  const plan: Record<string, string> = {
    q_screen: 'ans-2to5', q_headache: 'ans-never', q_night: 'ans-no', q_glasses: 'ans-no', q_exam: 'ans-lt1',
  }
  for (let i = 0; i < 12; i++) {
    if (await page.getByTestId('chart-start').count()) break
    // The interview is over when the first test screen (with the camera guard) is shown.
    if (await page.getByTestId('guard-status').count()) break
    const q = await page.getByTestId('question').innerText()
    seen.push(q)
    const ids = await page.locator('[data-testid^="ans-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!))
    if (ids.length === 0) break
    let pick = ids.includes('ans-no') && ids.includes('ans-yes') ? 'ans-no' : ids[0]
    for (const [, v] of Object.entries(plan)) if (ids.includes(v)) pick = v
    await page.getByTestId(pick).click()
  }
  return seen
}

/** The camera is not available in the plain phone project, so staff use the tape override. */
export async function tape(page: Page) {
  await page.getByText(/I measured the distance|मैंने दूरी नाप ली है|ମୁଁ ଦୂରତା ମାପିଲି/).click()
}

export async function chartTest(page: Page, passLines: number) {
  await tape(page)
  await page.getByTestId('chart-start').click()
  let done = false
  while (!done) {
    const runner = page.getByTestId('chart-runner')
    if (!(await runner.count())) break
    const dirs = (await page.getByTestId('debug-dirs').textContent())!.split(',')
    const logmar = Number(await runner.getAttribute('data-logmar'))
    const lineNo = Math.round((1.0 - logmar) * 10) + 1 // 1 for logMAR 1.0
    for (const d of dirs) {
      if (lineNo <= passLines) await page.getByTestId(`dir-${d}`).click()
      else await page.getByTestId('dir-cant').click()
      if (await page.getByTestId('chart-result').count()) {
        done = true
        break
      }
    }
  }
  await expect(page.getByTestId('chart-result')).toBeVisible()
  await page.getByTestId('chart-continue').click()
}

export async function astig(page: Page, darker = false) {
  await tape(page)
  if (darker) {
    await page.getByTestId('astig-darker').click()
    await page.getByTestId('astig-dial').click({ position: { x: 170, y: 40 } })
    await page.getByTestId('astig-confirm').click()
  } else {
    await page.getByTestId('astig-same').click()
  }
}

export async function color(page: Page) {
  await tape(page)
  for (let i = 0; i < 6; i++) {
    const digit = await page.getByTestId('plate').getAttribute('data-digit')
    await page.getByTestId(`num-${digit}`).click()
  }
  await expect(page.getByTestId('color-done')).toBeVisible()
  await page.getByTestId('color-continue').click()
}

/** Whole visit with taps only. Photo is skipped. */
export async function fullVisit(page: Page, lang: Lang = 'en', opts: { passLines?: number } = {}) {
  await startVisit(page, lang)
  await calibrate(page)
  await interview(page)
  await chartTest(page, opts.passLines ?? 7) // right
  await chartTest(page, opts.passLines ?? 7) // left
  await chartTest(page, 5) // near
  await astig(page, true)
  await astig(page, false)
  await color(page)
  await page.getByTestId('photo-continue').click()
}
