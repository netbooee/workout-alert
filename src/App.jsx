import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Summary from './pages/Summary'
import WorkoutDetail from './pages/WorkoutDetail'
import LockScreen from './components/LockScreen'

function isUnlocked() {
  // If no PIN is configured, app is always open
  if (!import.meta.env.VITE_APP_PIN) return true
  return sessionStorage.getItem('unlocked') === '1'
}

export default function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked)

  useEffect(() => {
    // Re-lock if the tab was restored from bfcache after session cleared
    const onVisibility = () => {
      if (!isUnlocked()) setUnlocked(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Summary />} />
        <Route path="/workout/:id" element={<WorkoutDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
