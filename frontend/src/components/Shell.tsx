import { useState, type ReactNode } from 'react'
import { LANGS, useT } from '../i18n'
import { FLOW, useStore } from '../state/store'

/** Frame around every screen: progress bar, language menu, Back and Skip. */
export function Shell(props: { title: string; children: ReactNode; onSkip?: () => void; onBack?: () => void; hideBack?: boolean }) {
  const t = useT()
  const { step, lang, setLang, back, go } = useStore()
  const [menu, setMenu] = useState(false)
  const idx = Math.max(0, FLOW.indexOf(step))
  const pct = Math.round((idx / (FLOW.length - 1)) * 100)

  return (
    <div className="shell">
      <header className="top no-print">
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="top-row">
          <span className="brand">{t('app_name')}</span>
          <span className="small muted">
            {t('step')} {idx + 1} / {FLOW.length}
          </span>
          <button className="ghost" aria-label={t('menu')} onClick={() => setMenu(!menu)}>
            {t('menu')}
          </button>
        </div>
        {menu && (
          <div className="menu" data-testid="menu">
            <div className="small muted">{t('language')}</div>
            <div className="row">
              {LANGS.map((l) => (
                <button key={l.code} className={lang === l.code ? 'chip on' : 'chip'} onClick={() => setLang(l.code)}>
                  {l.label}
                </button>
              ))}
            </div>
            <button className="ghost" onClick={() => { setMenu(false); go('camera_cal') }}>
              Camera calibration
            </button>
          </div>
        )}
      </header>
      <main>
        <h1>{props.title}</h1>
        {props.children}
      </main>
      <footer className="bottom no-print">
        {!props.hideBack && (
          <button className="secondary" onClick={props.onBack ?? back}>
            {t('back')}
          </button>
        )}
        {props.onSkip && (
          <button className="ghost" onClick={props.onSkip} data-testid="skip">
            {t('skip')}
          </button>
        )}
      </footer>
    </div>
  )
}

export function BrightnessBanner() {
  const t = useT()
  return <div className="banner info no-print">{t('cal_brightness')}</div>
}
