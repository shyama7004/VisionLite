import { LANGS, useT } from '../i18n'
import { useStore } from '../state/store'
import { Shell } from '../components/Shell'

export function Welcome() {
  const t = useT()
  const { lang, setLang, go, newVisit, session } = useStore()
  const started = session.consent || session.interview !== null || session.tests.near !== null

  return (
    <Shell title={t('welcome_title')} hideBack>
      <p className="lead">{t('welcome_sub')}</p>
      <div className="row" role="group" aria-label={t('language')}>
        {LANGS.map((l) => (
          <button key={l.code} className={lang === l.code ? 'chip on' : 'chip'} onClick={() => setLang(l.code)} data-testid={`lang-${l.code}`}>
            {l.label}
          </button>
        ))}
      </div>
      <button className="primary big" data-testid="start" onClick={() => { if (started) newVisit(); useStore.getState().go('consent') }}>
        {t('start_visit')}
      </button>
      {started && (
        <button className="secondary" onClick={() => go('consent')}>
          {t('continue')}
        </button>
      )}
      <p className="small muted disclaimer">{t('disclaimer_default')}</p>
    </Shell>
  )
}
