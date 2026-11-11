import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { Shell } from '../components/Shell'
import { api } from '../lib/api'
import { formatRange, recommendRules } from '../lib/rules'
import { saveOrQueue } from '../lib/offline'
import { snellen } from '../lib/optotype'
import type { Recommendation } from '../lib/types'

export function Result() {
  const t = useT()
  const { session, newVisit, synced } = useStore()
  const rulesRec = recommendRules(session)
  const [rec, setRec] = useState<Recommendation>(rulesRec)
  const [online, setOnline] = useState(navigator.onLine)
  const [fromServer, setFromServer] = useState(false)

  // Rules work offline at once. The server adds the model based range when it is reachable.
  useEffect(() => {
    let alive = true
    api
      .recommend(session)
      .then((r) => {
        if (alive) {
          setRec(r)
          setFromServer(true)
          setOnline(true)
        }
      })
      .catch(() => {
        if (alive) {
          setRec(rulesRec)
          setFromServer(false)
          setOnline(false)
        }
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  const blocked = rec.referral.blocks_lens_advice
  const tests = session.tests
  const eyeLine = (r: { logmar: number } | null) => (r ? `${snellen(r.logmar)}  (logMAR ${r.logmar.toFixed(1)})` : t('res_not_done'))

  const download = async () => {
    await saveOrQueue(session)
    window.location.href = `/api/sessions/${session.id}/report.pdf`
  }

  return (
    <Shell title={t('res_title')}>
      {rec.referral.level === 'refer' && (
        <div className="banner danger" data-testid="refer-banner">
          <b>{t('res_refer')}</b>
          <ul>{rec.referral.reasons.map((c) => <li key={c}>{t('code_' + c)}</li>)}</ul>
          {blocked && <p>{t('res_block')}</p>}
        </div>
      )}
      {rec.referral.level === 'advise' && (
        <div className="banner warn" data-testid="advise-banner">
          <b>{t('res_advise')}</b>
          <ul>{rec.referral.reasons.map((c) => <li key={c}>{t('code_' + c)}</li>)}</ul>
        </div>
      )}

      <section className="card">
        <h2>{t('res_eyes')}</h2>
        <table className="tbl">
          <tbody>
            <tr><td>{t('res_right')}</td><td>{eyeLine(tests.chart.right)}</td></tr>
            <tr><td>{t('res_left')}</td><td>{eyeLine(tests.chart.left)}</td></tr>
            <tr><td>{t('res_near')}</td><td>{eyeLine(tests.near)}</td></tr>
            <tr><td>{t('res_astig')}</td><td>{rec.skipped.includes('astig') ? t('res_not_done') : rec.astigmatism_hint ? t('res_yes') : t('res_no')}</td></tr>
            <tr><td>{t('res_color')}</td><td>{rec.skipped.includes('color') ? t('res_not_done') : rec.color_hint ? t('res_yes') : t('res_no')}</td></tr>
          </tbody>
        </table>
        {rec.astigmatism_hint && <p className="small">{t('astig_note')}</p>}
        {rec.color_hint && <p className="small">{t('color_note')}</p>}
      </section>

      {!blocked && (
        <section className="card" data-testid="lens-card">
          <h2>{t('res_lens')}</h2>
          <p className="lead" data-testid="lens-type">{t('lens_' + rec.lens.type)}</p>
          <ul>{rec.lens.reasons.map((c) => <li key={c}>{t('code_' + c)}</li>)}</ul>
          {(rec.power.right || rec.power.left) && (
            <>
              <h3>{t('res_power')}</h3>
              <p>
                {t('res_right')}: {rec.power.right ? formatRange(rec.power.right) : t('res_none')}
                <br />
                {t('res_left')}: {rec.power.left ? formatRange(rec.power.left) : t('res_none')}
              </p>
            </>
          )}
          {rec.power.add && (
            <p>
              {t('res_add')}: {formatRange(rec.power.add)}
            </p>
          )}
          {rec.power.source !== 'none' && (
            <p className="small muted">
              {t('res_power_note')} {rec.power.source === 'model' ? t('res_source_model') : t('res_source_rules')}
            </p>
          )}
          <h3>{t('res_coatings')}</h3>
          {rec.coatings.length === 0 ? (
            <p>{t('res_none')}</p>
          ) : (
            <ul>
              {rec.coatings.map((c) => (
                <li key={c.name}>
                  {t('coat_' + c.name)}: {t('code_' + c.why)}
                  {c.name === 'blue_light' && <div className="small muted">{t('blue_light_note')}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(rec.frame.pd_mm || rec.frame.size) && (
        <section className="card">
          <h2>{t('res_frame')}</h2>
          <p>
            {rec.frame.pd_mm ? `${t('res_pd')}: ${rec.frame.pd_mm} mm` : ''} {rec.frame.size ? ` ${t('photo_size')}: ${t('size_' + rec.frame.size)}` : ''}
          </p>
        </section>
      )}

      {rec.skipped.length > 0 && (
        <p className="small" data-testid="skipped">
          {t('res_skipped')}: {rec.skipped.map((s) => t('skip_' + s)).join(', ')}
        </p>
      )}
      {!fromServer && <p className="small muted no-print" data-testid="offline-note">{t('res_offline')}</p>}

      <p className="disclaimer" data-testid="disclaimer">{t(rec.disclaimer_key)}</p>
      <p className="small muted">{t('res_visit_id')}: {session.id.slice(0, 8)} · {synced ? t('res_saved') : t('res_pending')}</p>

      <div className="row no-print">
        <button className="primary" data-testid="pdf" disabled={!online} onClick={download}>
          {t('res_download')}
        </button>
        <button className="secondary" data-testid="print" onClick={() => window.print()}>
          {t('res_print')}
        </button>
        <button className="ghost" data-testid="new-visit" onClick={newVisit}>
          {t('new_visit')}
        </button>
      </div>
    </Shell>
  )
}
