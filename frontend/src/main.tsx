import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { initStore } from './state/store'
import { startAutoSync } from './lib/offline'
import './styles.css'

// Service worker: lets the app load with no network after the first visit.
registerSW({ immediate: true })

void initStore().then(() => startAutoSync())
createRoot(document.getElementById('root')!).render(<App />)
