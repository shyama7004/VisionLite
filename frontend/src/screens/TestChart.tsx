import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { Shell, BrightnessBanner } from '../components/Shell'
import { DistanceGuard } from '../components/DistanceGuard'
import { ChartRun, CHART_LINES, NEAR_LINES, NEAR_DISTANCE_MM, TEST_DISTANCE_MM, drawE, snellen, type Dir } from '../lib/optotype'
import type { ChartResult } from '../lib/types'

type Kind = 'right' | 'left' | 'near'

export function TestChart({ kind }: { kind: Kind }) {
  const t = useT()
  const { session, patchTests, next, seed } = useStore()
  const near = kind === 'near'
  const distance = near ? NEAR_DISTANCE_MM : TEST_DISTANCE_MM
  const title = near ? t('near_title') : kind === 'right' ? t('chart_title_right') : t('chart_title_left')
  const cover = near ? t('test_cover_none') : kind === 'right' ? t('test_cover_right') : t('test_cover_left')

  const [started, setStarted] = useState(false)
  const [glasses, setGlasses] = useState(false)
  const [result, setResult] = useState<ChartResult | null>(null)

  const finish = (r: ChartResult) => {
    setResult(r)
    if (near) patchTests({ near: r })
    else patchTests({ chart: { ...session.tests.chart, [kind]: r } })
  }

  const skip = () => {
    if (near) patchTests({ near: null })
    else patchTests({ chart: { ...session.tests.chart, [kind]: null } })
    next()
  }

  return (
    <Shell title={title} onSkip={skip}>
      <BrightnessBanner />
      <DistanceGuard testName={near ? 'near' : `chart_${kind}`} targetMm={distance}>
        {(ok) =>
          result ? (
            <div className="card" data-testid="chart-result">
              <p className="lead">
                {snellen(result.logmar)} (logMAR {result.logmar.toFixed(1)})
              </p>
              <button className="primary big" data-testid="chart-continue" onClick={next}>
                {t('continue')}
              </button>
            </div>
          ) : !started ? (
            <div className="card">
              <p>{cover}</p>
              {near && <p className="small muted">{t('near_hint')}</p>}
              <label className="check">
                <input type="checkbox" checked={glasses} onChange={(e) => setGlasses(e.target.checked)} data-testid="glasses" />
                {near ? t('test_glasses_near') : t('test_glasses_distance')}
              </label>
              <button className="primary big" data-testid="chart-start" onClick={() => setStarted(true)}>
                {t('test_start')}
              </button>
            </div>
          ) : (
            <ChartRunner
              ok={ok}
              lines={near ? NEAR_LINES : CHART_LINES}
              distance={distance}
              seed={seed + (near ? 3 : kind === 'right' ? 1 : 2)}
              onDone={(logmar, line_results) => finish({ logmar, line_results, tested_with_glasses: glasses })}
            />
          )
        }
      </DistanceGuard>
    </Shell>
  )
}

function ChartRunner(props: {
  ok: boolean
  lines: number[]
  distance: number
  seed: number
  onDone: (logmar: number, lines: ChartRun['results']) => void
}) {
  const t = useT()
  const pxPerMm = useStore((s) => s.session.calibration?.px_per_mm ?? 6.1)
  const run = useMemo(
    () => new ChartRun(props.lines, pxPerMm, props.distance, window.innerWidth, props.seed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [, force] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wasOk = useRef(true)

  // When the distance goes wrong the line is hidden. When it is fixed, the line restarts with new directions.
  useEffect(() => {
    if (props.ok && !wasOk.current) {
      run.startLine()
      force((n) => n + 1)
    }
    wasOk.current = props.ok
  }, [props.ok, run])

  const px = run.symbolPx
  const n = run.dirs.length
  const width = Math.min(window.innerWidth - 16, Math.ceil(px * (2 * n - 1)) + 16)
  const height = Math.ceil(px) + 24

  useEffect(() => {
    const c = canvas.current
    if (!c || !props.ok) return
    const dpr = window.devicePixelRatio || 1
    c.width = width * dpr
    c.height = height * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    const total = px * (2 * n - 1)
    const x0 = (width - total) / 2
    run.dirs.forEach((d, i) => {
      const x = x0 + i * 2 * px
      drawE(ctx, x, 4, px, d)
      if (i === run.answers.length && n > 1) {
        ctx.fillStyle = '#0b5cab'
        ctx.fillRect(x, height - 8, px, 4)
      }
    })
  })

  const answer = (a: Dir | null) => {
    run.answer(a)
    if (run.finished) props.onDone(run.result, run.results)
    else force((x) => x + 1)
  }

  const DIRS: { d: Dir; arrow: string }[] = [
    { d: 'up', arrow: '↑' },
    { d: 'left', arrow: '←' },
    { d: 'right', arrow: '→' },
    { d: 'down', arrow: '↓' },
  ]

  return (
    <div className="chart" data-testid="chart-runner" data-logmar={run.logmar.toFixed(1)} data-count={n} data-answered={run.answers.length}>
      <p className="small muted">
        logMAR {run.logmar.toFixed(1)} · {t('test_symbol')} {Math.min(run.answers.length + 1, n)} / {n}
      </p>
      <div className="chart-stage">
        {props.ok ? <canvas ref={canvas} style={{ width, height }} data-testid="chart-canvas" /> : <div className="hidden-line" />}
      </div>
      <p className="small">{t('test_direction_q')}</p>
      <div className="dpad">
        {DIRS.map(({ d, arrow }) => (
          <button key={d} className={`dir dir-${d}`} data-testid={`dir-${d}`} aria-label={t(d)} onClick={() => answer(d)} disabled={!props.ok}>
            <span>{arrow}</span>
            <small>{t(d)}</small>
          </button>
        ))}
        <button className="secondary cant" data-testid="dir-cant" onClick={() => answer(null)} disabled={!props.ok}>
          {t('cant_tell')}
        </button>
      </div>
      {/* Test helper: shows the true directions only when the page is opened with ?debug=1. */}
      {new URLSearchParams(location.search).get('debug') === '1' && (
        <p data-testid="debug-dirs" hidden>
          {run.dirs.join(',')}
        </p>
      )}
    </div>
  )
}
