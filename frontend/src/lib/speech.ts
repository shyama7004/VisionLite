import { SPEECH_LANG } from '../i18n'
import type { Lang } from './types'

// Reads a question aloud with the phone's own voices. Many phones have no Odia voice.
// In that case the screen shows "Staff: please read this aloud" instead of staying silent.

function voices(): SpeechSynthesisVoice[] {
  return 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []
}

export function findVoice(lang: Lang): SpeechSynthesisVoice | null {
  const want = SPEECH_LANG[lang].toLowerCase()
  const base = want.split('-')[0]
  const all = voices()
  return (
    all.find((v) => v.lang.toLowerCase().replace('_', '-') === want) ??
    all.find((v) => v.lang.toLowerCase().startsWith(base + '-') || v.lang.toLowerCase() === base) ??
    null
  )
}

export function hasVoice(lang: Lang): boolean {
  return findVoice(lang) !== null
}

export function speak(text: string, lang: Lang): boolean {
  const v = findVoice(lang)
  if (!v) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.voice = v
  u.lang = v.lang
  window.speechSynthesis.speak(u)
  return true
}

/** Voices load late on some browsers. Call back when the list changes. */
export function onVoicesChanged(cb: () => void): () => void {
  if (!('speechSynthesis' in window)) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', cb)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', cb)
}

// Screen Wake Lock keeps the screen on during tests. Not every browser has it.
let lock: WakeLockSentinel | null = null
export async function keepAwake(): Promise<void> {
  try {
    if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen')
  } catch {
    lock = null
  }
}
export function releaseAwake(): void {
  void lock?.release().catch(() => {})
  lock = null
}
