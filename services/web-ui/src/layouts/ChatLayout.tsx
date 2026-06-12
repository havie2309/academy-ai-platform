import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar.tsx'

export default function ChatLayout() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}
