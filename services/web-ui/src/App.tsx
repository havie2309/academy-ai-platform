import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ChatLayout from './layouts/ChatLayout.tsx'
import HomePage from './pages/HomePage.tsx'
import ChatPage from './pages/ChatPage.tsx'
import DocsPage from './pages/DocsPage.tsx'
import KhoDuLieuPage from './pages/KhoDuLieuPage.tsx'
import TraCuuPage from './pages/TraCuuPage.tsx'
import AdminPage from './pages/AdminPage.tsx'
import AccountPage from './pages/AccountPage.tsx'
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
            <Route path="/" element={<HomePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:sessionId" element={<ChatPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/docs/kho-du-lieu" element={<KhoDuLieuPage />} />
            <Route path="/docs/tra-cuu" element={<TraCuuPage />} />
            <Route path="/account" element={<AccountPage />} />

            <Route element={<RequireAuth allowedRoles={['ADMIN', 'BGD', 'P2', 'P7']} />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>

            <Route element={<RequireAuth allowedRoles={['ADMIN']} />}>
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
