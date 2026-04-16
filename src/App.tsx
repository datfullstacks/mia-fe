import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminPage } from './pages/AdminPage'
import { GatePage } from './pages/GatePage'
import { RoomPage } from './pages/RoomPage'

function App() {
  return (
    <Routes>
      <Route index element={<Navigate replace to="/gate" />} />
      <Route path="/gate" element={<GatePage />} />
      <Route path="/room" element={<RoomPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  )
}

export default App
