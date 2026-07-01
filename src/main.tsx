import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { WorkbenchRoot } from './auth.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkbenchRoot />
  </StrictMode>,
)
