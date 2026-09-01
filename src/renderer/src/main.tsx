import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './styles/settings.css'
import './styles/discover.css'
import './styles/analytics.css'
import './styles/sources.css'
import './styles/workspace.css'
import './styles/local-search.css'
import './styles/accessibility.css'

const reflectWindowActivity = () => {
  document.documentElement.dataset.windowActive = String(document.hasFocus())
}

reflectWindowActivity()
window.addEventListener('focus', reflectWindowActivity)
window.addEventListener('blur', reflectWindowActivity)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App api={window.therss} />
  </React.StrictMode>
)
