import en from './en.json'
import hi from './hi.json'
import or from './or.json'
import type { Lang } from '../lib/types'
import { useStore } from '../state/store'

const dict: Record<Lang, Record<string, string>> = { en, hi, or }

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
]

export function tr(lang: Lang, key: string): string {
  return dict[lang][key] ?? dict.en[key] ?? key
}

/** Returns a translate function bound to the current language. */
export function useT(): (key: string) => string {
  const lang = useStore((s) => s.lang)
  return (key: string) => tr(lang, key)
}

export const SPEECH_LANG: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', or: 'or-IN' }
