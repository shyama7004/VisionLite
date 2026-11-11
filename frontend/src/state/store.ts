import { create } from 'zustand'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import type { Lang, Session } from '../lib/types'
import { saveOrQueue } from '../lib/offline'
import { loadCalibration } from '../lib/calibration'
import { newSeed } from '../lib/rng'

export type Step =
  | 'welcome' | 'consent' | 'calibrate' | 'interview'
  | 'chart_right' | 'chart_left' | 'near' | 'astig_right' | 'astig_left' | 'color'
  | 'photo' | 'result' | 'camera_cal'

export const FLOW: Step[] = [
  'welcome', 'consent', 'calibrate', 'interview',
  'chart_right', 'chart_left', 'near', 'astig_right', 'astig_left', 'color',
  'photo', 'result',
]

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'v-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export function emptySession(lang: Lang): Session {
  return {
    id: uuid(),
    created_at: new Date().toISOString(),
    language: lang,
    consent: false,
    customer: { name: null, phone: null },
    interview: null,
    calibration: loadCalibration(),
    tests: { chart: { right: null, left: null }, near: null, astig: { right: null, left: null }, color: null },
    photo: null,
    distance_log: [],
  }
}

interface State {
  lang: Lang
  step: Step
  seed: number
  session: Session
  synced: boolean
  ready: boolean
  setLang: (l: Lang) => void
  go: (s: Step) => void
  next: () => void
  back: () => void
  patch: (p: Partial<Session>) => void
  patchTests: (p: Partial<Session['tests']>) => void
  logDistance: (e: Session['distance_log'][number]) => void
  newVisit: () => void
}

export const useStore = create<State>((set, get) => ({
  lang: 'en',
  step: 'welcome',
  seed: newSeed(),
  session: emptySession('en'),
  synced: false,
  ready: false,
  setLang: (lang) => set((s) => ({ lang, session: { ...s.session, language: lang } })),
  go: (step) => set({ step }),
  next: () => {
    const i = FLOW.indexOf(get().step)
    if (i >= 0 && i < FLOW.length - 1) set({ step: FLOW[i + 1] })
  },
  back: () => {
    const i = FLOW.indexOf(get().step)
    if (i > 0) set({ step: FLOW[i - 1] })
  },
  patch: (p) => set((s) => ({ session: { ...s.session, ...p } })),
  patchTests: (p) => set((s) => ({ session: { ...s.session, tests: { ...s.session.tests, ...p } } })),
  logDistance: (e) => set((s) => ({ session: { ...s.session, distance_log: [...s.session.distance_log, e] } })),
  newVisit: () => set((s) => ({ step: 'welcome', seed: newSeed(), session: emptySession(s.lang), synced: false })),
}))

const KEY = 'visionlite.state'

/** Restore an unfinished visit after a page refresh, then keep saving every change. */
export async function initStore(): Promise<void> {
  try {
    const saved = await idbGet(KEY)
    if (saved?.session) {
      useStore.setState({ lang: saved.lang, step: saved.step, seed: saved.seed, session: saved.session })
    }
  } catch {
    /* storage blocked: start fresh */
  }
  useStore.setState({ ready: true })
  let timer: number | undefined
  useStore.subscribe((s) => {
    if (!s.ready) return
    void idbSet(KEY, { lang: s.lang, step: s.step, seed: s.seed, session: s.session }).catch(() => {})
    // Save to the server (or the offline queue) a moment after the last change.
    window.clearTimeout(timer)
    timer = window.setTimeout(async () => {
      const cur = useStore.getState()
      if (cur.step === 'welcome') return
      const ok = await saveOrQueue(cur.session)
      useStore.setState({ synced: ok })
    }, 600)
  })
}
