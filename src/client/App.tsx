import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import FlowEditor from './pages/FlowEditor'
import FlowPreview from './pages/FlowPreview'
import Flows from './pages/Flows'
import Settings from './pages/Settings'
import Pairing from './pages/Pairing'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/flows" element={<ProtectedRoute><Flows /></ProtectedRoute>} />
          <Route path="/flow-editor/:flowId?" element={<ProtectedRoute><FlowEditor /></ProtectedRoute>} />
          <Route path="/flow-preview/:flowId" element={<ProtectedRoute><FlowPreview /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/pairing" element={<ProtectedRoute><Pairing /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
      <Toaster />
    </>
  )
}

export default App
