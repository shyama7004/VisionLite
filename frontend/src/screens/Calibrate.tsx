import { useState } from 'react'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { Shell, BrightnessBanner } from '../components/Shell'
import { CARD_H, CARD_W, isPlausible, loadCalibration, saveCalibration } from '../lib/calibration'

// A bank card is 85.6 mm by 53.98 mm. The long side does not fit across a phone held upright,
// so the card is held upright: its short side (53.98 mm) is the width of the box.
const SHORT = Math.min(CARD_W, CARD_H)
const LONG = Math.max(CARD_W, CARD_H)

export function Calibrate() {
  const t = useT()
  const { patch, next } = useStore()
  const saved = loadCalibration()
  const maxW = Math.max(200, Math.min(window.innerWidth - 8, 12 * SHORT))
  const [width, setWidth] = useState(Math.min(maxW, 6 * SHORT))
  const [touched, setTouched] = useState(false)
  const [phase, setPhase] = useState<1 | 2>(1)
  const [err, setErr] = useState('')

  const pxPerMm = width / SHORT

  const use = (v: number) => {
    const c = saveCalibration(v)
    patch({ calibration: c })
    next()
  }

  const finish = () => {
    if (!isPlausible(pxPerMm)) return setErr(t('cal_bad'))
    use(pxPerMm)
  }

  return (
    <Shell title={t('cal_title')}>
      <BrightnessBanner />
      {saved && phase === 1 && !touched && (
        <div className="card">
          <p>{t('cal_reuse')}</p>
          <p className="small muted">{saved.px_per_mm.toFixed(2)} px/mm</p>
          <button className="primary" data-testid="cal-use-saved" onClick={() => use(saved.px_per_mm)}>
            {t('cal_use_saved')}
          </button>
        </div>
      )}
      <p>{phase === 1 ? t('cal_step1') : t('cal_step2')}</p>
      <div className="cal-stage">
        <div
          className="cal-box"
          data-testid="cal-box"
          style={{ width, height: phase === 2 ? (width * LONG) / SHORT : width * 0.62 }}
        />
      </div>
      {phase === 1 && (
        <>
          <label className="small">
            {t('cal_width')}: {Math.round(width)} px
            <input
              type="range"
              data-testid="cal-slider"
              min={150}
              max={maxW}
              value={width}
              onChange={(e) => {
                setWidth(Number(e.target.value))
                setTouched(true)
                setErr('')
              }}
            />
          </label>
          <button
            className="primary big"
            data-testid="cal-next"
            onClick={() => (touched ? setPhase(2) : setErr(t('cal_untouched')))}
          >
            {t('next')}
          </button>
        </>
      )}
      {phase === 2 && (
        <div className="row">
          <button className="secondary" onClick={() => setPhase(1)}>
            {t('cal_recal')}
          </button>
          <button className="primary big" data-testid="cal-save" onClick={finish}>
            {t('cal_save')}
          </button>
        </div>
      )}
      {err && <div className="banner warn">{err}</div>}
    </Shell>
  )
}
