import { useState } from 'react'
import { useT } from '../i18n'
import { useStore } from '../state/store'
import { Shell } from '../components/Shell'

export function Consent() {
  const t = useT()
  const { session, patch, next } = useStore()
  const [store, setStore] = useState(session.consent)
  const [name, setName] = useState(session.customer.name ?? '')
  const [phone, setPhone] = useState(session.customer.phone ?? '')

  const accept = () => {
    // Name and phone are kept only when the box is ticked.
    patch({
      consent: store,
      customer: store ? { name: name.trim() || null, phone: phone.trim() || null } : { name: null, phone: null },
    })
    next()
  }

  return (
    <Shell title={t('consent_title')}>
      <p className="lead">{t('consent_body')}</p>
      <label className="check">
        <input type="checkbox" checked={store} onChange={(e) => setStore(e.target.checked)} data-testid="consent-store" />
        {t('consent_store')}
      </label>
      {store && (
        <>
          <input className="field" placeholder={t('consent_name')} value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field" placeholder={t('consent_phone')} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </>
      )}
      <p className="small muted">{t('disclaimer_default')}</p>
      <button className="primary big" data-testid="consent-ok" onClick={accept}>
        {t('consent_ok')}
      </button>
    </Shell>
  )
}
