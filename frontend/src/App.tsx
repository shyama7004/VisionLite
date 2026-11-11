import { useEffect } from 'react'
import { useStore } from './state/store'
import { keepAwake, releaseAwake } from './lib/speech'
import { Welcome } from './screens/Welcome'
import { Consent } from './screens/Consent'
import { Calibrate } from './screens/Calibrate'
import { Interview } from './screens/Interview'
import { TestChart } from './screens/TestChart'
import { TestAstig } from './screens/TestAstig'
import { TestColor } from './screens/TestColor'
import { Photo } from './screens/Photo'
import { Result } from './screens/Result'
import { CameraCal } from './screens/CameraCal'

export default function App() {
  const { step, ready, lang } = useStore()

  // Keep the screen awake during a visit.
  useEffect(() => {
    if (step === 'welcome') releaseAwake()
    else void keepAwake()
  }, [step])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  if (!ready) return null

  switch (step) {
    case 'welcome': return <Welcome />
    case 'consent': return <Consent />
    case 'calibrate': return <Calibrate />
    case 'interview': return <Interview />
    case 'chart_right': return <TestChart kind="right" key="cr" />
    case 'chart_left': return <TestChart kind="left" key="cl" />
    case 'near': return <TestChart kind="near" key="cn" />
    case 'astig_right': return <TestAstig eye="right" key="ar" />
    case 'astig_left': return <TestAstig eye="left" key="al" />
    case 'color': return <TestColor />
    case 'photo': return <Photo />
    case 'result': return <Result />
    case 'camera_cal': return <CameraCal />
  }
}
