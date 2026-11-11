import type { Recommendation, Session } from './types'

// Small helpers for the server. Every call can fail when offline, so callers must handle that.
async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail: any = null
    try {
      detail = await res.json()
    } catch {
      /* ignore */
    }
    const err: any = new Error(`HTTP ${res.status}`)
    err.status = res.status
    err.detail = detail?.detail ?? detail
    throw err
  }
  return res.json() as Promise<T>
}

export interface Health {
  ok: boolean
  whisper: boolean
  model: boolean
  odia_asr: boolean
  version: string
}

export const api = {
  health: () => fetch('/api/health').then((r) => j<Health>(r)),
  putSession: (s: Session) =>
    fetch(`/api/sessions/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    }).then((r) => j<{ id: string }>(r)),
  recommend: (s: Session) =>
    fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    }).then((r) => j<Recommendation>(r)),
  sync: (sessions: Session[]) =>
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions }),
    }).then((r) => j<{ ids: string[] }>(r)),
  transcribe: (blob: Blob, lang: string, expect: 'yesno' | 'number' | 'choice', choices?: { value: string; label: string }[]) => {
    const fd = new FormData()
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
    fd.append('audio', blob, `answer.${ext}`)
    if (choices) fd.append('choices', JSON.stringify(choices))
    return fetch(`/api/voice/transcribe?lang=${lang}&expect=${expect}`, { method: 'POST', body: fd }).then((r) =>
      j<{ text: string; matched: string | number | null; confidence: number }>(r),
    )
  },
  photo: (blob: Blob, kind: 'face' | 'glasses', points?: number[][]) => {
    const fd = new FormData()
    fd.append('image', blob, 'photo.jpg')
    fd.append('kind', kind)
    if (points) fd.append('points', JSON.stringify(points))
    return fetch('/api/vision/photo', { method: 'POST', body: fd }).then((r) =>
      j<{
        ok: boolean
        needs_manual?: boolean
        message?: string
        pd_mm?: number
        face_width_mm?: number
        frame_width_mm?: number
        frame_size?: 'small' | 'medium' | 'large'
      }>(r),
    )
  },
}
