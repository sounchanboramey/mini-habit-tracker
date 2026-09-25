import { useRegisterSW } from 'virtual:pwa-register/react'

// ---------------------------------------------------------------------------
// UpdateToast
//
// Shown when a new service worker is waiting to activate.
// registerType: 'prompt' means we control when the update is applied.
// Calling updateServiceWorker(true) tells the waiting SW to skipWaiting,
// then the page reloads to activate the new version.
//
// How to trigger for testing:
//   1. npm run build && npm run preview
//   2. Load the page (SW installs)
//   3. Make any code change, rebuild
//   4. Reload page once → SW waits
//   5. Reload page again → toast appears
// ---------------------------------------------------------------------------
export default function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[SW] registered:', r)
    },
    onRegisterError(error) {
      console.error('[SW] registration error:', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <span>✦ New version available</span>
      <button
        className="update-toast-btn"
        onClick={() => updateServiceWorker(true)}
      >
        Refresh
      </button>
    </div>
  )
}
