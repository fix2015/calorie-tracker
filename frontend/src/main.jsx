import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import App from './App.jsx'
import { preloadInitialLanguage } from './i18n/translations'

// Fetch the active locale chunk (non-English only) before rendering to avoid a flash of English
preloadInitialLanguage().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
