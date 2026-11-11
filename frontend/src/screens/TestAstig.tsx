import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { Shell, BrightnessBanner } from '../components/Shell'
import { DistanceGuard } from '../components/DistanceGuard'
import { NEAR_DISTANCE_MM } from '../lib/optotype'

const LINES = 18 // one line every 10 degrees, 0 to 170

/** Angle (0 to 170, 0 = horizontal, 90 = vertical) of the dial line nearest to a tap. */
export function nearestLineDeg(dx: number, dy: number): number {
  let deg = (Math.atan2(-dy, dx) * 180) / Math.PI // screen y grows downward
  deg = ((deg % 180) + 180) % 180
  return (Math.round(deg / 10) * 10) % 180
}

export function TestAstig({ eye }: { eye: 'right' | 'left' }) {
  const t = useT()
  const { session, patchTests, next } = useStore()
  const [phase, setPhase] = useState<'ask' | 'tap'>('ask')
  const [picked, setPicked] = useState<number | null>(null)

  const save = (unequal: boolean, deg: number | null) => {
    patchTests({ astig: { ...session.tests.astig, [eye]: { unequal, darkest_deg: deg } } })
    next()
  }
  const skip = () => {
    patchTests({ astig: { ...session.tests.astig, [eye]: null } })
    next()
  }

  return (
    <Shell title={eye === 'right' ? t('astig_title_right') : t('astig_title_left')} onSkip={skip}>
      <BrightnessBanner />
      <DistanceGuard testName={`astig_${eye}`} targetMm={NEAR_DISTANCE_MM}>
        {(ok) => (
          <>
            <p>{eye === 'right' ? t('test_cover_right') : t('test_cover_left')}</p>
            {ok ? (
              <Dial picked={picked} labels={phase === 'tap'} onPick={phase === 'tap' ? setPicked : undefined} />
            ) : (
              <div className="hidden-line" />
            )}
            {phase === 'ask' ? (
              <>
                <p className="lead">{t('astig_q')}</p>
                <div className="row">
                  <button className="primary big" data-testid="astig-same" onClick={() => save(false, null)}>
                    {t('astig_same')}
                  </button>
                  <button className="secondary big" data-testid="astig-darker" onClick={() => setPhase('tap')}>
                    {t('astig_darker')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="lead">{t('astig_tap')}</p>
                <button className="primary big" data-testid="astig-confirm" disabled={picked === null} onClick={() => save(true, picked)}>
                  {t('continue')}
                </button>
              </>
            )}
          </>
        )}
      </DistanceGuard>
    </Shell>
  )
}

function Dial(props: { picked: number | null; labels: boolean; onPick?: (deg: number) => void }) {
  const pxPerMm = useStore((s) => s.session.calibration?.px_per_mm ?? 6.1)
  const ref = useRef<HTMLCanvasElement>(null)
  const size = Math.min(window.innerWidth - 24, 340)

  useEffect(() => {
    const c = ref.current!
    const dpr = window.devicePixelRatio || 1
    c.width = size * dpr
    c.height = size * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, size, size)
    const cx = size / 2
    const R = size / 2 - (props.labels ? 22 : 6)
    ctx.lineCap = 'butt'
    for (let i = 0; i < LINES; i++) {
      const a = (i * 10 * Math.PI) / 180
      ctx.strokeStyle = props.picked === i * 10 ? '#d33' : '#000'
      ctx.lineWidth = Math.max(1, 0.4 * pxPerMm) // about 0.4 mm
      ctx.beginPath()
      ctx.moveTo(cx - Math.cos(a) * R, cx + Math.sin(a) * R)
      ctx.lineTo(cx + Math.cos(a) * R, cx - Math.sin(a) * R)
      ctx.stroke()
    }
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(cx, cx, 3, 0, Math.PI * 2)
    ctx.fill()
    if (props.labels) {
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let h = 1; h <= 12; h++) {
        const a = (h * 30 * Math.PI) / 180
        ctx.fillText(String(h), cx + Math.sin(a) * (R + 14), cx - Math.cos(a) * (R + 14))
      }
    }
  })

  return (
    <canvas
      ref={ref}
      data-testid="astig-dial"
      style={{ width: size, height: size, touchAction: 'manipulation' }}
      onClick={(e) => {
        if (!props.onPick) return
        const r = e.currentTarget.getBoundingClientRect()
        props.onPick(nearestLineDeg(e.clientX - r.left - size / 2, e.clientY - r.top - size / 2))
      }}
    />
  )
}
