import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { Shell } from '../components/Shell'
import { api } from '../lib/api'

type Kind = 'face' | 'glasses'

/** Shrinks the photo to at most 1280 px on the long side and returns a JPEG. */
async function shrink(file: File): Promise<{ blob: Blob; w: number; h: number; url: string }> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * k)
  const h = Math.round(bmp.height * k)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.9))
  return { blob, w, h, url: URL.createObjectURL(blob) }
}

export function Photo() {
  const t = useT()
  const { patch, next } = useStore()
  const [kind, setKind] = useState<Kind>('face')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [manual, setManual] = useState<{ blob: Blob; url: string; w: number; h: number } | null>(null)

  const apply = (r: Awaited<ReturnType<typeof api.photo>>) => {
    if (!r.ok) {
      setMsg(r.message ?? t('photo_fail'))
      return false
    }
    patch({
      photo: {
        pd_mm: r.pd_mm ?? null,
        face_width_mm: r.face_width_mm ?? null,
        frame_size: r.frame_size ?? null,
        source: kind,
      },
    })
    setOkMsg(`${t('photo_ok')} ${r.pd_mm ? `${t('res_pd')}: ${r.pd_mm} mm. ` : ''}${r.frame_size ? `${t('photo_size')}: ${t('size_' + r.frame_size)}` : ''}`)
    setManual(null)
    return true
  }

  const onFile = async (f?: File) => {
    if (!f) return
    setBusy(true)
    setMsg('')
    setOkMsg('')
    try {
      const img = await shrink(f)
      const r = await api.photo(img.blob, kind)
      if (r.needs_manual) setManual(img)
      else apply(r)
    } catch (e: any) {
      setMsg(e?.status ? (e.detail?.message ?? t('photo_fail')) : t('photo_needs_internet'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title={t('photo_title')} onSkip={next}>
      <div className="row">
        <button className={kind === 'face' ? 'chip on' : 'chip'} data-testid="kind-face" onClick={() => setKind('face')}>
          {t('photo_face')}
        </button>
        <button className={kind === 'glasses' ? 'chip on' : 'chip'} data-testid="kind-glasses" onClick={() => setKind('glasses')}>
          {t('photo_glasses')}
        </button>
      </div>
      <p>{kind === 'face' ? t('photo_face_hint') : t('photo_glasses_hint')}</p>
      <label className="primary big filebtn">
        {t('photo_take')}
        <input
          type="file"
          accept="image/*"
          capture={kind === 'face' ? 'user' : 'environment'}
          data-testid="photo-file"
          hidden
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      {busy && <p className="muted">{t('photo_sending')}</p>}
      {msg && <div className="banner warn" data-testid="photo-msg">{msg}</div>}
      {okMsg && <div className="banner ok" data-testid="photo-ok">{okMsg}</div>}
      {manual && (
        <ManualCaliper
          img={manual}
          onDone={async (points) => {
            setBusy(true)
            try {
              apply(await api.photo(manual.blob, 'glasses', points))
            } catch {
              setMsg(t('photo_needs_internet'))
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
      <button className="primary big" data-testid="photo-continue" onClick={next}>
        {t('continue')}
      </button>
    </Shell>
  )
}

/** Fallback when the glasses are not found: staff taps frame left, frame right, card start, card end. */
function ManualCaliper(props: { img: { url: string; w: number; h: number }; onDone: (p: number[][]) => void }) {
  const t = useT()
  const [pts, setPts] = useState<number[][]>([])
  const ref = useRef<HTMLImageElement>(null)
  return (
    <div className="card">
      <p className="small">{t('photo_manual_hint')} ({pts.length}/4)</p>
      <div className="caliper">
        <img
          ref={ref}
          src={props.img.url}
          alt=""
          data-testid="caliper-img"
          style={{ width: '100%' }}
          onClick={(e) => {
            if (pts.length >= 4) return
            const r = e.currentTarget.getBoundingClientRect()
            const x = ((e.clientX - r.left) / r.width) * props.img.w
            const y = ((e.clientY - r.top) / r.height) * props.img.h
            setPts([...pts, [x, y]])
          }}
        />
        {pts.map(([x, y], i) => (
          <span key={i} className="dot" style={{ left: `${(x / props.img.w) * 100}%`, top: `${(y / props.img.h) * 100}%` }}>
            {i + 1}
          </span>
        ))}
      </div>
      <div className="row">
        <button className="ghost" onClick={() => setPts([])}>{t('retry')}</button>
        <button className="primary" disabled={pts.length < 4} data-testid="caliper-send" onClick={() => props.onDone(pts)}>
          {t('continue')}
        </button>
      </div>
    </div>
  )
}
