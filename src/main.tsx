import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/ds.css'
import './styles/app.css'
import { App } from './App'
import { actions } from './state/store'

void actions.init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
