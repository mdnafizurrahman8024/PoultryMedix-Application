import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import './index.css'
import App from './App.jsx'
import './theme.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
)
