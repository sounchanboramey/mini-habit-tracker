import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// OfflineBanner — hand-written per assignment requirement
//
// Listens to the browser's online/offline events.
// Shows a yellow banner when the connection drops.
// Dismisses automatically when connectivity is restored.
//
// Why window events instead of polling?
// The browser fires these reliably on network change; no interval needed.
// ---------------------------------------------------------------------------
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    function handleOnline()  { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="offline-banner" role="status" aria-live="assertive">
      <span>📡</span>
      You're offline — habits added now will sync when you reconnect.
    </div>
  )
}
