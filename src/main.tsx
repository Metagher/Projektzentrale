import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'

const PRELOAD_RELOAD_KEY = 'pz-preload-reload'
try {
  sessionStorage.removeItem(PRELOAD_RELOAD_KEY)
} catch {
  // sessionStorage kann in restriktiven Browser-Modi fehlen; dann bleibt die Reload-Schleifenbremse einfach aus.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch((error: unknown) => {
      console.warn('Service Worker konnte nicht registriert werden.', error)
    })
  })
}

// Ein offen gelassener Tab kann nach einem neuen Deploy noch auf inzwischen vom Server
// gelöschte, alte Chunk-Dateien verweisen (Vite-Hashes ändern sich pro Build). Statt einer
// leeren Seite erzwingt das hier einmalig einen vollständigen Reload, der den aktuellen
// Build frisch lädt. Die sessionStorage-Markierung verhindert eine Reload-Schleife, falls
// der Fehler danach erneut auftritt. Siehe https://vite.dev/guide/build.html#load-error-handling
window.addEventListener('vite:preloadError', () => {
  try {
    if (sessionStorage.getItem(PRELOAD_RELOAD_KEY)) return
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, '1')
  } catch {
    // ohne sessionStorage riskieren wir im Zweifel lieber eine Reload-Schleife als eine leere Seite
  }
  window.location.reload()
})
