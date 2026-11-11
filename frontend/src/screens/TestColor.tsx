import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { Shell, BrightnessBanner } from '../components/Shell'
import { DistanceGuard } from '../components/DistanceGuard'
import { NEAR_DISTANCE_MM } from '../lib/optotype'
import { drawPlate, generatePlate, plateDigits, scoreColor } from '../lib/plates'

const SIZE = 300

export function TestColor() {
  const t = useT()
  const { session, patchTests, next, seed } = useStore()
  const digits = useMemo(() => plateDigits(seed), [seed])
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [retry, setRetry] = useState(0) // the control plate may be repeated once
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState<ReturnType<typeof scoreColor> | null>(null)
  const ref = useRef<HTMLCanvasElement>(null)

  // Plate 1 is the control. A repeat of the control uses a new pattern (new seed) of the same digit.
  const plate = useMemo(
    () => generatePlate(seed + idx * 101 + retry * 7919, digits[idx], idx === 0, SIZE),
    [seed, idx, retry, digits],
  )

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = SIZE * dpr
    c.height = SIZE * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    drawPlate(ctx, plate)
  })

  const finish = (scored: ReturnType<typeof scoreColor>) => {
    setDone(scored)
    patchTests({ color: { ...scored, seed } })
  }

  const answer = (a: number | null) => {
    if (idx === 0 && a !== digits[0]) {
      if (retry === 0) {
        setRetry(1)
        setMsg(t('color_retry_light'))
        return
      }
      return finish(scoreColor(digits, [a], false))
    }
    setMsg('')
    const all = [...answers, a]
    if (all.length === digits.length) return finish(scoreColor(digits, all))
    setAnswers(all)
    setIdx(idx + 1)
  }

  const skip = () => {
    patchTests({ color: null })
    next()
  }

  return (
    <Shell title={t('color_title')} onSkip={skip}>
      <BrightnessBanner />
      <DistanceGuard testName="color" targetMm={NEAR_DISTANCE_MM}>
        {(ok) =>
          done ? (
            <div className="card" data-testid="color-done">
              <p className="lead">{done.invalid ? t('color_invalid') : t('done')}</p>
              <button className="primary big" data-testid="color-continue" onClick={next}>
                {t('continue')}
              </button>
            </div>
          ) : (
            <>
              <p className="small muted">
                {t('color_plate')} {idx + 1} / {digits.length}
              </p>
              <div className="plate-stage">
                {ok ? <canvas ref={ref} style={{ width: SIZE, height: SIZE }} data-testid="plate" data-digit={new URLSearchParams(location.search).get('debug') === '1' ? digits[idx] : undefined} /> : <div className="hidden-line" style={{ height: SIZE }} />}
              </div>
              {msg && <div className="banner warn">{msg}</div>}
              <p className="lead">{t('color_q')}</p>
              <div className="numpad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                  <button key={n} className="num" data-testid={`num-${n}`} disabled={!ok} onClick={() => answer(n)}>
                    {n}
                  </button>
                ))}
                <button className="secondary nothing" data-testid="num-none" disabled={!ok} onClick={() => answer(null)}>
                  {t('color_nothing')}
                </button>
              </div>
            </>
          )
        }
      </DistanceGuard>
    </Shell>
  )
}
