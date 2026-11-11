import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { Shell } from '../components/Shell'
import { api, type Health } from '../lib/api'
import { hasVoice, onVoicesChanged, speak } from '../lib/speech'
import type { Interview as IV, RedFlags } from '../lib/types'

type Opt = [value: string, labelKey: string]
interface Q {
  id: string
  textKey: string
  type: 'number' | 'choice' | 'yesno'
  opts?: Opt[]
  flag?: keyof RedFlags
  onlyIf?: (a: Record<string, any>) => boolean
}

const YN: Opt[] = [['yes', 'yes'], ['no', 'no']]

// Same order in all languages. Questions 8 to 13 (red flags) need optometrist review.
export const QUESTIONS: Q[] = [
  { id: 'age', textKey: 'q_age', type: 'number' },
  { id: 'screen_hours', textKey: 'q_screen', type: 'choice', opts: [['lt2', 'a_lt2'], ['2to5', 'a_2to5'], ['6to9', 'a_6to9'], ['gt9', 'a_gt9']] },
  { id: 'headaches', textKey: 'q_headache', type: 'choice', opts: [['never', 'a_never'], ['sometimes', 'a_sometimes'], ['often', 'a_often']] },
  { id: 'night_driving_trouble', textKey: 'q_night', type: 'choice', opts: [['yes', 'yes'], ['no', 'no'], ['does_not_drive', 'a_notdrive']] },
  { id: 'wears_glasses', textKey: 'q_glasses', type: 'yesno', opts: YN },
  { id: 'glasses_age', textKey: 'q_glassesage', type: 'choice', opts: [['lt1', 'a_lt1'], ['1to2', 'a_1to2'], ['gt2', 'a_gt2']], onlyIf: (a) => a.wears_glasses === 'yes' },
  { id: 'last_eye_exam', textKey: 'q_exam', type: 'choice', opts: [['never', 'a_never'], ['lt1', 'a_lt1'], ['1to2', 'a_1to2'], ['gt2', 'a_gt2']] },
  { id: 'rf_sudden', textKey: 'q_r_sudden', type: 'yesno', opts: YN, flag: 'sudden_vision_change' },
  { id: 'rf_pain', textKey: 'q_r_pain', type: 'yesno', opts: YN, flag: 'eye_pain_or_redness' },
  { id: 'rf_flash', textKey: 'q_r_flash', type: 'yesno', opts: YN, flag: 'flashes_or_floaters' },
  { id: 'rf_double', textKey: 'q_r_double', type: 'yesno', opts: YN, flag: 'double_vision' },
  { id: 'rf_diabetes', textKey: 'q_r_diabetes', type: 'yesno', opts: YN, flag: 'diabetes' },
  { id: 'rf_injury', textKey: 'q_r_injury', type: 'yesno', opts: YN, flag: 'eye_injury_or_surgery' },
]

export function buildInterview(a: Record<string, any>): IV {
  const flags: RedFlags = {
    sudden_vision_change: false, eye_pain_or_redness: false, flashes_or_floaters: false,
    double_vision: false, diabetes: false, eye_injury_or_surgery: false,
  }
  for (const q of QUESTIONS) if (q.flag) flags[q.flag] = a[q.id] === 'yes'
  const wears = a.wears_glasses === 'yes'
  return {
    age: a.age ?? 30,
    screen_hours: a.screen_hours ?? 'lt2',
    headaches: a.headaches ?? 'never',
    night_driving_trouble: a.night_driving_trouble ?? 'no',
    wears_glasses: wears,
    glasses_age: wears ? (a.glasses_age ?? null) : null,
    last_eye_exam: a.last_eye_exam ?? 'lt1',
    red_flags: flags,
  }
}

export function Interview() {
  const t = useT()
  const { lang, session, patch, next } = useStore()
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [pos, setPos] = useState(0)
  const [age, setAge] = useState('')
  const [voiceTick, setVoiceTick] = useState(0)

  const visible = QUESTIONS.filter((q) => !q.onlyIf || q.onlyIf(answers))
  const q = visible[Math.min(pos, visible.length - 1)]
  const text = t(q.textKey)
  const canSpeak = hasVoice(lang)

  useEffect(() => onVoicesChanged(() => setVoiceTick((n) => n + 1)), [])
  useEffect(() => { if ('speechSynthesis' in window) window.speechSynthesis.getVoices() }, [])
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel() }, [])
  void voiceTick

  const setAnswer = (value: any) => {
    const a = { ...answers, [q.id]: value }
    setAnswers(a)
    const vis = QUESTIONS.filter((x) => !x.onlyIf || x.onlyIf(a))
    patch({ interview: buildInterview(a) })
    if (pos + 1 >= vis.length) {
      next()
    } else {
      setPos(pos + 1)
      setAge('')
    }
  }

  const back = () => {
    if (pos > 0) setPos(pos - 1)
    else useStore.getState().back()
  }

  const ageNum = Number(age)
  const ageOk = Number.isInteger(ageNum) && ageNum >= 5 && ageNum <= 99
  void session

  return (
    <Shell title={t('int_title')} onBack={back}>
      <p className="small muted" data-testid="q-count">
        {pos + 1} / {visible.length}
      </p>
      <div className="question" data-testid="question">{text}</div>
      <div className="row">
        <button className="secondary" data-testid="speak" onClick={() => speak(text, lang)} disabled={!canSpeak}>
          {t('int_listen')}
        </button>
        {!canSpeak && <span className="small warn-text" data-testid="staff-read">{t('int_staff_read')}</span>}
      </div>

      {q.type === 'number' ? (
        <div className="age">
          <input
            className="field big-input"
            inputMode="numeric"
            data-testid="age-input"
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))}
          />
          <button className="primary big" data-testid="age-ok" disabled={!ageOk} onClick={() => setAnswer(ageNum)}>
            {t('int_age_ok')}
          </button>
        </div>
      ) : (
        <div className="answers">
          {q.opts!.map(([v, k]) => (
            <button key={v} className="answer" data-testid={`ans-${v}`} onClick={() => setAnswer(v)}>
              {t(k)}
            </button>
          ))}
        </div>
      )}

      <VoiceAnswer
        key={q.id}
        q={q}
        onMatched={(v) => {
          if (q.type === 'number') {
            setAge(String(v))
          } else {
            setAnswer(v)
          }
        }}
      />
    </Shell>
  )
}

/** Microphone button. Always optional: tapping an answer is the main path. */
function VoiceAnswer({ q, onMatched }: { q: Q; onMatched: (v: string | number) => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const [health, setHealth] = useState<Health | null | 'down'>(null)
  const [state, setState] = useState<'idle' | 'rec' | 'send' | 'heard'>('idle')
  const [heard, setHeard] = useState<{ text: string; matched: string | number | null } | null>(null)
  const [note, setNote] = useState('')
  const rec = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth('down'))
    return () => {
      window.clearTimeout(timer.current)
      stream.current?.getTracks().forEach((x) => x.stop())
    }
  }, [])

  if (health === null) return null
  if (health === 'down') return <p className="small muted">{t('int_voice_internet')}</p>
  if (lang === 'or' && !health.odia_asr) return <p className="small muted" data-testid="odia-off">{t('int_voice_odia_off')}</p>
  if (!health.whisper) return <p className="small muted">{t('int_voice_internet')}</p>

  const start = async () => {
    setNote('')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Chrome records webm, Safari records mp4. Pick what this browser supports.
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m))
      const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      r.ondataavailable = (e) => chunks.push(e.data)
      r.onstop = async () => {
        stream.current?.getTracks().forEach((x) => x.stop())
        setState('send')
        const blob = new Blob(chunks, { type: r.mimeType || mime || 'audio/webm' })
        try {
          const expect = q.type === 'number' ? 'number' : q.type === 'yesno' ? 'yesno' : 'choice'
          const choices = q.opts?.map(([value, key]) => ({ value, label: t(key) }))
          const res = await api.transcribe(blob, lang, expect, choices)
          setHeard({ text: res.text, matched: res.matched })
          setState('heard')
          if (res.matched === null) setNote(t('int_no_match'))
        } catch {
          setState('idle')
          setNote(t('int_voice_internet'))
        }
      }
      rec.current = r
      r.start()
      setState('rec')
      timer.current = window.setTimeout(() => r.state === 'recording' && r.stop(), 5000)
    } catch {
      setNote(t('int_voice_internet'))
    }
  }
  const stop = () => rec.current?.state === 'recording' && rec.current.stop()

  return (
    <div className="voice">
      {state === 'idle' && (
        <button className="secondary" data-testid="mic" onClick={start}>
          {t('int_mic')}
        </button>
      )}
      {state === 'rec' && (
        <button className="danger" data-testid="mic-stop" onClick={stop}>
          {t('int_stop')}
        </button>
      )}
      {state === 'send' && <span className="small muted">{t('loading')}</span>}
      {state === 'heard' && heard && (
        <div className="card">
          <p>
            {t('int_heard')}: <b>{heard.text || '-'}</b>
          </p>
          {heard.matched !== null && (
            <button className="primary" data-testid="voice-confirm" onClick={() => onMatched(heard.matched!)}>
              {t('int_confirm')}: {String(q.opts?.find(([v]) => v === heard.matched)?.[1] ? t(q.opts!.find(([v]) => v === heard.matched)![1]) : heard.matched)}
            </button>
          )}
          <button className="ghost" onClick={() => setState('idle')}>
            {t('retry')}
          </button>
        </div>
      )}
      {note && <p className="small warn-text">{note}</p>}
    </div>
  )
}
