import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ChatLayout from './layouts/ChatLayout.tsx'
import ChatPage from './pages/ChatPage.tsx'
import DocsPage from './pages/DocsPage.tsx'
import AdminPage from './pages/AdminPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'
import LoginPage from "./pages/LoginPage.tsx"
import RequireAuth from "./components/RequireAuth.tsx"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<ChatLayout />}>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:sessionId" element={<ChatPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Admin only */}
            <Route element={<RequireAuth allowedRoles={['ADMIN', 'BGD', 'P2', 'P7']} />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
