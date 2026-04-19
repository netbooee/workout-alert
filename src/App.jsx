import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Summary from './pages/Summary'
import WorkoutDetail from './pages/WorkoutDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Summary />} />
        <Route path="/workout/:id" element={<WorkoutDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
