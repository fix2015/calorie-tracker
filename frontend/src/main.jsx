import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import App from './App.jsx'
import { preloadInitialLanguage } from './i18n/translations'
import { initSocialLogin } from './services/socialLogin'

// Load the Sign in with Apple / Google SDKs early (on the web this also completes the Google popup)
initSocialLogin().catch(() => {})

// Fetch the active locale chunk (non-English only) before rendering to avoid a flash of English
preloadInitialLanguage().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
