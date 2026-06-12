import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ChatLayout from './layouts/ChatLayout.tsx'
import ChatPage from './pages/ChatPage.tsx'
import DocsPage from './pages/DocsPage.tsx'
import AdminPage from './pages/AdminPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatLayout />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="docs" element={<DocsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App