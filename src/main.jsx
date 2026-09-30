import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AppSettingsProvider } from './context/AppSettingsContext'
import { AuthProvider } from './context/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AppSettingsProvider>
        <App />
      </AppSettingsProvider>
    </AuthProvider>
  </React.StrictMode>,
)

// Register Service Worker for PWA Installability on Android Chrome
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('Jal-Jivan Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('Jal-Jivan Service Worker registration error:', err);
      });
  });
}
