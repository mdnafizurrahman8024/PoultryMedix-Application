import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { UserProvider } from './context/UserContext.jsx'
import './index.css'
import App from './App.jsx'
import './theme.css'
import ErrorBoundary from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <StrictMode>
      <ThemeProvider>
        <UserProvider>
          <LanguageProvider>
            <App />
          </LanguageProvider>
        </UserProvider>
      </ThemeProvider>
    </StrictMode>
  </ErrorBoundary>,
)
